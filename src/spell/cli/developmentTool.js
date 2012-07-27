define(
	'spell/cli/developmentTool',
	[
		'spell/server/main',

		'spell/shared/build/executeCreateDebugBuild',
		'spell/shared/build/initializeProjectDirectory',
		'spell/shared/build/exportDeploymentArchive',
		'spell/shared/build/isDirectory',
		'spell/shared/build/isFile',

		'commander',
		'fs',
		'path',
		'spell/functions'
	],
	function(
		serverMain,

		executeCreateDebugBuild,
		initializeProjectDirectory,
		exportDeploymentArchive,
		isDirectory,
		isFile,

		commander,
		fs,
		path,
		_
	) {
		/*
		 * private
		 */

		var printErrors = function( errors ) {
			var tmp = []
			tmp = tmp.concat( errors )

			console.error( tmp.join( '\n' ) )
		}

		var onComplete = function( action, errors ) {
			if( errors &&
				errors.length > 0 ) {

				printErrors( errors )
				console.log( action + ' failed' )
				process.exit()

			} else {
				console.log( action + ' completed' )
			}
		}


		/*
		 * public
		 */

		return function( argv, cwd, spellCorePath ) {
			var executableName  = 'sappre',
				projectPath     = cwd,
				projectFilename = 'project.json',
				projectFilePath = projectPath + '/' + projectFilename

			var buildVersions = {
				DEBUG      : 'debug',
				DEPLOYMENT : 'deploy',
				ALL        : 'all'
			}

			var buildTargets = {
				HTML5 : 'html5',
				FLASH : 'flash',
				ALL   : 'all'
			}

			var buildCommand = function( projectFilePath, target, version, command ) {
				var errors = []

				if( !version ) version = buildVersions.DEBUG
				if( !target ) target = buildTargets.HTML5

				var minify = !!command.minify,
					anonymizeModules = !!command.anonymizeModules

				if( !_.contains( _.values( buildTargets ), target ) ) {
					errors.push( 'Error: \'' + target + '\' is not a valid target. See \'' + executableName + ' --help\'.' )

				} else if( !_.contains( _.values( buildVersions ), version ) ) {
					errors.push( 'Error: \'' + version + '\' is not a valid version. See \'' + executableName + ' --help\'.' )
				}

				if( errors.length > 0 ) {
					printErrors( errors )

					return
				}


				if( version === buildVersions.DEBUG ) {
					console.log( 'creating debug build for target \'' + target + '\'...' )

					if( isFile( projectFilePath ) ) {
						executeCreateDebugBuild( target, spellCorePath, projectPath, projectFilePath, minify, anonymizeModules, _.bind( onComplete, null, 'build' ) )

					} else {
						printErrors( 'Error: Missing project file \'' + projectFilePath + '\'.' )
					}

				} else if( version === buildVersions.DEPLOYMENT ) {
					console.log( 'creating deployment build...' )
				}
			}

			var startServerCommand = function( command ) {
				var errors = [],
					userId = command.user || process.getuid(),
					projectsPath = path.resolve( cwd + ( command.projectsRoot ? '/' + command.projectsRoot : '' ) )

				if( !fs.existsSync( projectsPath ) ) {
					errors.push( 'Error: No valid projects directory supplied. Unable to start build server. ' +
						'See \'' + executableName + ' start-server --help\'.' )
				}

				if( errors.length > 0 ) {
					printErrors( errors )

				} else {
					serverMain( spellCorePath, projectsPath, userId, command.port )
				}
			}

			var initCommand = function( spellCorePath, projectPath, projectFilePath ) {
				var errors = initializeProjectDirectory( spellCorePath, path.basename( projectPath ), projectPath, projectFilePath )

				if( errors.length > 0 ) {
					printErrors( errors )

				} else {
					console.log( 'Initialized spell project in \'' + projectPath + '\'' )
				}
			}

			var exportCommand = function( projectPath, command ) {
				var outputFilePath = _.isString( command.file ) ?
					path.resolve( command.file ) :
					path.resolve( projectPath, 'export.tar' )

				exportDeploymentArchive( projectPath, outputFilePath, _.bind( onComplete, null, 'export' ) )
			}

			var infoCommand = function( spellCorePath, projectPath, projectFilePath ) {
				console.log( 'spell sdk path:\t\t' + spellCorePath )
				console.log( 'project path:\t\t' + projectPath )
				console.log( 'project file path:\t' + projectFilePath )
			}


			commander
				.version( '0.0.1' )

			commander
				.command( 'build [version] [target]' )
				.option( '-m, --minify', 'if supplied the engine gets minified' )
				.option( '-a, --anonymize-modules', 'if supplied amd module identifiers get anonymized' )
				.description( 'build a specific version [deploy, debug (default)] for a specific target [flash, html5 (default)]' )
				.action( _.bind( buildCommand, this, projectFilePath ) )

			commander
				.command( 'start-server' )
				.option( '-u, --user [username]', 'the user the server drops it\'s privileges to' )
				.option( '-p, --port [port number]', 'the port the server runs on' )
				.option( '-r, --projects-root [directory]', 'The path to the projects directory that contains the project directories. The default is the current working directory.' )
				.description( 'start the dev server - run with superuser privileges to enable flash target support' )
				.action( startServerCommand )

			commander
				.command( 'init' )
				.description( 'initialize the current working directory with spell project scaffolding' )
				.action( _.bind( initCommand, this, spellCorePath, projectPath, projectFilePath ) )

			commander
				.command( 'export' )
				.option( '-f, --file [file]', 'the name of the output file' )
				.description( 'export a deployment ready version into a zip archive' )
				.action( _.bind( exportCommand, this, projectPath ) )

			commander
				.command( 'info' )
				.description( 'print information about current environment' )
				.action( _.bind( infoCommand, this, spellCorePath, projectPath, projectFilePath ) )

			commander.parse( argv )
		}
	}
)
