/**
 * The SceneManager enables controlling of the currently executed scene.
 *
 * @class spell.sceneManager
 * @singleton
 */
define(
	'spell/SceneManager',
	[
		'spell/client/loading/loadSceneResources',
		'spell/shared/util/scene/Scene',

		'spell/functions'
	],
	function(
		loadSceneResources,
		Scene,

		_
	) {
		'use strict'


		var update = function( entityManager, scene, timeInMs, deltaTimeInMs ) {
			entityManager.updateDeferredEvents( deltaTimeInMs )
			scene.update( timeInMs, deltaTimeInMs )
		}

		var postLoadedResources = function( spell, entityManager, libraryManager, statisticsManager, isModeDevelopment, sceneId, initialConfig ) {
			var sceneConfig = spell.scenes[ sceneId ]

			if( !sceneConfig ) {
				throw 'Error: Could not find scene configuration for scene "' + sceneId + '".'
			}

			var scene = new Scene( spell, entityManager, libraryManager, statisticsManager, isModeDevelopment, sceneConfig, initialConfig )

			scene.init()

			this.mainLoop.setRenderCallback( _.bind( scene.render, scene ) )
			this.mainLoop.setUpdateCallback( _.bind( update, null, entityManager, scene ) )

			this.activeScene = scene

			this.loadingPending = false
			this.processCmdQueue()

			if( this.sendMessageToEditor ) {
				this.sendMessageToEditor( 'spelled.debug.application.sceneStarted', sceneId )
			}
		}

		var startScene = function( targetSceneId, initialConfig, showLoadingScene ) {
			var freeMemory = showLoadingScene

			var preNextFrameCallback = function() {
				var spell = this.spell

				if( this.activeScene ) {
					this.mainLoop.setRenderCallback()
					this.mainLoop.setUpdateCallback()
					this.activeScene.destroy()
					this.activeScene = undefined

					if( freeMemory &&
						!spell.configurationManager.getValue( 'platform.hasPlentyRAM' ) ) {

						spell.assetManager.free()
						spell.libraryManager.free()
					}

					spell.statisticsManager.reset()
				}

				var onProgress = this.sendMessageToEditor ?
					_.bind( this.sendMessageToEditor, null, 'spelled.loadingProgress' ) :
					undefined

				this.cmdQueue = []
				this.loadingPending = true


				// check if library dependencies of next scene are already available
				var nextScene = spell.scenes[ targetSceneId ]

				if( nextScene &&
					spell.libraryManager.isAvailable( nextScene.libraryIds ) ) {

					// perform direct transition
					postLoadedResources.call(
						this,
						spell,
						this.entityManager,
						this.libraryManager,
						this.statisticsManager,
						this.isModeDevelopment,
						targetSceneId,
						initialConfig
					)

				} else {
					var loadingSceneId = spell.configurationManager.getValue( 'loadingScene' )

                    var nextSceneId     = targetSceneId,
                        nextSceneConfig = initialConfig

					if( showLoadingScene && loadingSceneId ) {
                        nextSceneId         = loadingSceneId
                        nextSceneConfig     = {
                            targetSceneId : targetSceneId,
                            initialConfig : initialConfig
                        }
                    }

                    loadSceneResources(
                        spell,
                        nextSceneId,
                        _.bind(
                            postLoadedResources,
                            this,
                            spell,
                            this.entityManager,
                            this.libraryManager,
                            this.statisticsManager,
                            this.isModeDevelopment,
                            nextSceneId,
                            nextSceneConfig
                        ),
                        onProgress
                    )
				}
			}

			this.mainLoop.setPreNextFrame( _.bind( preNextFrameCallback, this ) )
		}

		var SceneManager = function( spell, entityManager, statisticsManager, libraryManager, mainLoop, sendMessageToEditor, isModeDevelopment ) {
			this.activeScene
			this.entityManager       = entityManager
			this.mainLoop            = mainLoop
			this.sendMessageToEditor = sendMessageToEditor
			this.spell               = spell
			this.statisticsManager   = statisticsManager
			this.libraryManager      = libraryManager
			this.isModeDevelopment   = isModeDevelopment
			this.cmdQueue            = []
			this.loadingPending      = false
		}

		SceneManager.prototype = {
			/**
			 * Changes the currently executed scene to the scene specified by targetSceneId.
			 *
			 * @param {String} targetSceneId the library id of the scene to which to change
			 * @param {Object} initialConfig configuration passed to the target scene
			 * @param {Boolean} showLoadingScene if true the loading scene is displayed
			 */
			changeScene : function( targetSceneId, initialConfig, showLoadingScene ) {
				showLoadingScene = showLoadingScene || false

				if( !this.isModeDevelopment ) {
					startScene.call( this, targetSceneId, initialConfig, showLoadingScene )

				} else {
					this.spell.sendMessageToEditor(
						'spelled.debug.application.startScene',
						{
							targetSceneId : targetSceneId,
							initialConfig : initialConfig,
							showLoadingScene : showLoadingScene
						}
					)
				}
			},

			startScene : startScene,

			processCmdQueue : function() {
				if( this.loadingPending ) {
					return
				}

				var cmdQueue = this.cmdQueue

				for( var i = 0; i < cmdQueue.length; i++ ) {
					var cmd = cmdQueue[ i ]

					this.activeScene[ cmd.fn ].apply( this.activeScene, cmd.args )
				}

				cmdQueue.length = 0
			},

			addSystem : function( systemId, executionGroupId, index, systemConfig ) {
				this.cmdQueue.push( {
					fn   : 'addSystem',
					args : [ systemId, executionGroupId, index, systemConfig ]
				} )

				this.processCmdQueue()
			},

			moveSystem : function( systemId, srcExecutionGroupId, dstExecutionGroupId, dstIndex ) {
				this.cmdQueue.push( {
					fn   : 'moveSystem',
					args : [ systemId, srcExecutionGroupId, dstExecutionGroupId, dstIndex ]
				} )

				this.processCmdQueue()
			},

			removeSystem : function( systemId, executionGroupId ) {
				this.cmdQueue.push( {
					fn   : 'removeSystem',
					args : [ systemId, executionGroupId ]
				} )

				this.processCmdQueue()
			},

			restartSystem : function( systemId, executionGroupId, systemConfig ) {
				this.cmdQueue.push( {
					fn   : 'restartSystem',
					args : [ systemId, executionGroupId, systemConfig ]
				} )

				this.processCmdQueue()
			},

			updateSystem : function( systemId, executionGroupId, systemConfig ) {
				this.cmdQueue.push( {
					fn   : 'updateSystem',
					args : [ systemId, executionGroupId, systemConfig ]
				} )

				this.processCmdQueue()
			}
		}

		return SceneManager
	}
)
