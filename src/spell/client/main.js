define(
	'spell/client/main',
	[
		'spell/client/createSpell',
		'spell/client/development/createDebugMessageHandler',
		'spell/client/isDebug',
		'spell/client/staticInclude',
		'spell/client/setApplicationModule',
		'spell/client/showSplashScreen',
		'spell/shared/util/createMainLoop',
		'spell/EntityManager',
		'spell/SceneManager',
		'spell/AssetManager',
		'spell/ConfigurationManager',
		'spell/EventManager',
		'spell/InputManager',
		'spell/LibraryManager',
		'spell/shared/util/createModuleLoader',
		'spell/PluginManager',
		'spell/StatisticsManager',
		'spell/Console',
		'spell/VisibilityManager',
		'spell/PhysicsManager',
		'spell/RequestManager',
		'spell/shared/util/platform/PlatformKit',
		'spell/shared/util/platform/initDebugEnvironment',
		'spell/shared/util/translate',
		'spell/shared/util/platform/private/loader/ImageLoader',
		'spell/shared/util/platform/private/loader/SoundLoader',
		'spell/shared/util/platform/private/loader/TextLoader',
		'spell/functions'
	],
	function(
		createSpell,
		createDebugMessageHandler,
		isDebug,
		staticInclude,
		setApplicationModule,
		showSplashScreen,
		createMainLoop,
		EntityManager,
		SceneManager,
		AssetManager,
		ConfigurationManager,
		EventManager,
		InputManager,
		LibraryManager,
		createModuleLoader,
		PluginManager,
		StatisticsManager,
		Console,
		VisibilityManager,
		PhysicsManager,
		RequestManager,
		PlatformKit,
		initDebugEnvironment,
		translate,
		ImageLoader,
		SoundLoader,
		TextLoader,
		_,

		// configuration parameters passed in from stage zero loader
		stageZeroConfig
	) {
		'use strict'


		var preStart = function( applicationModule, cacheContent ) {
			PlatformKit.init( this.spell, _.bind( start, this, applicationModule, cacheContent ) )
		}

		var start = function( applicationModule, cacheContent ) {
			var spell                = this.spell,
				eventManager         = spell.eventManager,
				libraryManager       = spell.libraryManager,
				renderingContext     = spell.renderingContext,
				configurationManager = spell.configurationManager

            setApplicationModule(
                spell,
                configurationManager,
				PlatformKit.platformDetails.getTarget(),
                applicationModule,
                spell.loaderConfig
            )

			spell.console.setSendMessageToEditor( this.sendMessageToEditor )

            var isModeDevelopment    = configurationManager.getValue( 'mode' ) !== 'deployed'

			spell.console.debug( 'created rendering context (' + renderingContext.getConfiguration().type + ')' )
			spell.console.debug( 'created audio context (' + spell.audioContext.getConfiguration().type + ')' )

			if( cacheContent ) {
                libraryManager.addToCache( cacheContent )
            }

			var assetManager = new AssetManager( libraryManager )

			var moduleLoader = createModuleLoader( libraryManager, isModeDevelopment, configurationManager.getValue( 'libraryUrl' ) )

			var entityManager = new EntityManager( spell, configurationManager, assetManager, spell.eventManager, libraryManager, moduleLoader )

			var sceneManager = new SceneManager(
				spell,
				entityManager,
				spell.statisticsManager,
				libraryManager,
				spell.mainLoop,
				this.sendMessageToEditor,
				isModeDevelopment
			)

			var translatePartial = _.bind(
				translate,
				null,
				assetManager,
				configurationManager.getValue( 'currentLanguage' )
			)

			var inputManager = new InputManager( configurationManager, renderingContext )
			inputManager.init()

			spell.pluginManager        = new PluginManager( inputManager, spell.storage )
			spell.assetManager         = assetManager
			spell.configurationManager = configurationManager
			spell.moduleLoader         = moduleLoader
			spell.entityManager        = entityManager
			spell.physicsManager       = new PhysicsManager()
			spell.sceneManager         = sceneManager
			spell.sendMessageToEditor  = this.sendMessageToEditor

            var translationFn              = configurationManager.getValue( 'translateFn' )
            if( translationFn ) {
                spell.translate            = translationFn
            } else {
                spell.translate            = translatePartial
            }

            var urlRewriterFn = configurationManager.getValue( 'urlRewriterFn' )
            if( urlRewriterFn ) {
                spell.libraryManager.urlRewriter = urlRewriterFn
            }

			spell.inputManager         = inputManager
			spell.environment          = PlatformKit.createEnvironment( configurationManager, eventManager )
			spell.env                  = spell.environment
			spell.visibilityManager    = new VisibilityManager( eventManager, configurationManager, entityManager )
			spell.visibilityManager.init()

			spell.console.debug( 'client started' )

			var run = function() {
				spell.sceneManager.startScene( spell.applicationModule.startScene, undefined, !isModeDevelopment )
				spell.mainLoop.run()
			}

			/*if( applicationModule.environment &&
				applicationModule.environment.forceSplashScreen ) {

				showSplashScreen( spell, run )

			} else {*/
				run()
			//}
		}

		var init = function( loaderConfig ) {
			var spell                = createSpell(),
				console              = new Console(),
				eventManager         = new EventManager(),
				configurationManager = new ConfigurationManager( eventManager ),
				statisticsManager    = new StatisticsManager(),
				mainLoop             = createMainLoop( eventManager, statisticsManager, isDebug ),
				isModeDeployed       = loaderConfig.mode === 'deployed',
				isModeDevelopment    = configurationManager.getValue( 'mode' ) !== 'deployed'

			// creating rendering context
			var renderingContext = PlatformKit.RenderingFactory.createContext2d(
				spell.eventManager,
				configurationManager.getValue( 'id' ),
				configurationManager.getValue( 'currentScreenSize' )[ 0 ],
				configurationManager.getValue( 'currentScreenSize' )[ 1 ],
				configurationManager.getValue( 'renderingBackEnd' )
			)

			// creating audio context
			var audioContext = PlatformKit.AudioFactory.createAudioContext(
				configurationManager.getValue( 'audioBackEnd' )
			)

			var requestManager       = new RequestManager(
					PlatformKit.createImageLoader( renderingContext ),
					PlatformKit.createSoundLoader( audioContext ),
					PlatformKit.createTextLoader( )
				),
				libraryManager       = new LibraryManager(
					eventManager,
					requestManager,
					configurationManager.getValue( 'libraryUrl' ),
					!isModeDevelopment
				)

			spell.audioContext         = audioContext
			spell.renderingContext     = renderingContext
			spell.requestManager       = requestManager
			spell.libraryManager       = libraryManager

			statisticsManager.init()

			spell.applicationModule    = undefined
			spell.configurationManager = configurationManager
			if( loaderConfig.libraryUrl ) {
				spell.configurationManager.setValue( 'libraryUrl', loaderConfig.libraryUrl )
			}
			spell.eventManager         = eventManager
			spell.loaderConfig         = loaderConfig
			spell.console              = console
			spell.mainLoop             = mainLoop
			spell.registerTimer        = PlatformKit.registerTimer
			spell.scenes               = {}
			spell.statisticsManager    = statisticsManager
			spell.storage              = PlatformKit.createPersistentStorage()

			this.spell = spell

			if( !isModeDeployed ) {
				console.setLogLevel( console.LOG_LEVEL_DEBUG )
				initDebugEnvironment( console )

				this.debugMessageHandler = createDebugMessageHandler(
					spell,
					_.bind( this.start, this )
				)
			}
		}


		var main = function() {
			this.spell
			this.debugMessageHandler
			this.sendMessageToEditor

			init.call( this, stageZeroConfig )
		}

		main.prototype = {
			start : preStart,

			/*
			 * This callback is called when the engine instance sends message to the editing environment.
			 *
			 * @param {Function} fn
			 */
			setSendMessageToEditor : function( fn ) {
				this.sendMessageToEditor = fn
			},

			/*
			 * This method is used to send debug messages to the engine instance.
			 *
			 * @param {Object} message
			 */
			sendDebugMessage : function( message ) {
				this.debugMessageHandler( message.payload, message.type )
			}
		}

		return new main()
	}
)
