define(
	'spell/shared/util/scene/SceneManager',
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


		var postLoadedResources = function( spell, entityManager, templateManager, isModeDevelopment, sceneId ) {
			var scene       = new Scene( spell, entityManager, templateManager, isModeDevelopment ),
				sceneConfig = spell.scenes[ sceneId ]

			if( !sceneConfig ) {
				throw 'Error: Could not find scene configuration for scene \'' + sceneId + '\'.'
			}

			scene.init( sceneConfig )

			this.mainLoop.setRenderCallback( _.bind( scene.render, scene ) )
			this.mainLoop.setUpdateCallback( _.bind( scene.update, scene ) )

			this.activeScene = scene

			this.loadingPending = false
			this.processCmdQueue()
		}

		var SceneManager = function( spell, entityManager, templateManager, mainLoop, sendMessageToEditor, isModeDevelopment ) {
			this.activeScene
			this.entityManager       = entityManager
			this.mainLoop            = mainLoop
			this.sendMessageToEditor = sendMessageToEditor
			this.spell               = spell
			this.templateManager     = templateManager
			this.isModeDevelopment   = isModeDevelopment
			this.cmdQueue            = []
			this.loadingPending      = false
		}

		SceneManager.prototype = {
			startScene: function( sceneId ) {
				var onProgress = this.sendMessageToEditor ?
					_.bind( this.sendMessageToEditor, null, 'spell.loadingProgress' ) :
					undefined

				this.cmdQueue = []
				this.loadingPending = true

				loadSceneResources(
					this.spell,
					sceneId,
					_.bind(
						postLoadedResources,
						this,
						this.spell,
						this.entityManager,
						this.templateManager,
						this.isModeDevelopment,
						sceneId
					),
					onProgress
				)
			},

			processCmdQueue: function() {

				if ( this.loadingPending ) {
					return
				}

				for (var i=0; i < this.cmdQueue.length; i++) {
					var cmd = this.cmdQueue[ i ]

					this.activeScene[ cmd[ 'fn' ] ].apply( this.activeScene, cmd[ 'arguments' ])
				}

				this.cmdQueue.length = 0
			},

			addSystem: function( systemId, executionGroupId, index, systemConfig ) {
				this.cmdQueue.push({
					'fn'        : 'addSystem',
					'arguments' : [ systemId, executionGroupId, index, systemConfig ]
				})

				this.processCmdQueue()
			},

			moveSystem: function( systemId, srcExecutionGroupId, dstExecutionGroupId, dstIndex ) {
				this.cmdQueue.push({
					'fn'        : 'moveSystem',
					'arguments' : [ systemId, srcExecutionGroupId, dstExecutionGroupId, dstIndex ]
				})

				this.processCmdQueue()
			},

			removeSystem: function( systemId, executionGroupId ) {
				this.cmdQueue.push({
					'fn'        : 'removeSystem',
					'arguments' : [ systemId, executionGroupId ]
				})

				this.processCmdQueue()
			},

			restartSystem: function( systemId, executionGroupId, systemConfig ) {
				this.cmdQueue.push({
					'fn'        : 'restartSystem',
					'arguments' : [ systemId, executionGroupId, systemConfig ]
				})

				this.processCmdQueue()
			}
		}

		return SceneManager
	}
)
