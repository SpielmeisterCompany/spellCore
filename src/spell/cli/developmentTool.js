define(
	'spell/cli/developmentTool',
	[
		'funkysnakes/server/main',

		'spell/shared/build/executeCreateDebugBuild',
		'spell/shared/build/initializeProjectDirectory',
		'spell/shared/build/isDirectory',
		'spell/shared/build/isFile',

		'commander',
		'fs',
		'path',
		'underscore'
	],
	function(
		serverMain,

		executeCreateDebugBuild,
		initializeProjectDirectory,
		isDirectory,
		isFile,

		commander,
		fs,
		path,
		_
	) {
		return function( argv, cwd, spellPath ) {
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

	//		var executeCreateDeployBuild = function( projectFilePath ) {
	//		}

			var printErrors = function( errors ) {
				console.log( errors.join( '\n' ) )
			}

			var buildCommand = function( projectFilePath, target, version ) {
				var errors = []

				if( !version ) version = buildVersions.DEBUG
				if( !target ) target = buildTargets.HTML5

				if( !_.include( _.values( buildTargets ), target ) ) {
					errors.push( 'Error: \'' + target + '\' is not a valid target. See \'' + executableName + ' --help\'.' )

				} else if( !_.include( _.values( buildVersions ), version ) ) {
					errors.push( 'Error: \'' + version + '\' is not a valid version. See \'' + executableName + ' --help\'.' )
				}

				if( errors.length > 0 ) {
					printErrors( errors )

					return
				}


				if( version === buildVersions.DEBUG ) {
					console.log( 'creating debug build...' )

					if( isFile( projectFilePath ) ) {
						errors = executeCreateDebugBuild( target, spellPath, projectPath, projectFilePath )

					} else {
						errors.push( 'Error: Missing project file \'' + projectFilePath + '\'.' )
					}

				} else if( version === buildVersions.DEPLOYMENT ) {
					console.log( 'creating deployment build...' )

				} else if( version === buildVersions.ALL ) {

				}


				if( errors.length > 0 ) {
					errors.push( 'Error: Build failed.' )
					printErrors( errors )

				} else {
					console.log( 'completed successfully' )
				}
			}

			var startServerCommand = function( command ) {
				var errors = [],
					userId = command.user || process.getuid(),
					projectsPath = path.resolve( cwd + ( command.projectsRoot ? '/' + command.projectsRoot : '' ) )

				if( !path.existsSync( projectsPath ) ) {
					errors.push( 'Error: No valid projects directory supplied. Unable to start build server. ' +
						'See \'' + executableName + ' start-server --help\'.' )
				}

				if( errors.length > 0 ) {
					printErrors( errors )

				} else {
					serverMain( spellPath, projectsPath, userId, command.port )
				}
			}

			var initCommand = function( spellPath, projectPath, projectFilePath ) {
				var errors = initializeProjectDirectory( spellPath, path.basename( projectPath ), projectPath, projectFilePath )

				if( errors.length > 0 ) {
					printErrors( errors )

				} else {
					console.log( 'Initialized spell project in \'' + projectPath + '\'' )
				}
			}

			var infoCommand = function( spellPath, projectPath, projectFilePath ) {
				console.log( 'spell sdk path:\t\t' + spellPath )
				console.log( 'project path:\t\t' + projectPath )
				console.log( 'project file path:\t' + projectFilePath )
			}


			commander
				.version( '0.0.1' )

			commander
				.command( 'build [version] [target]' )
				.description( 'build a specific version [deploy, debug (default)] for a specific target [all, flash, html5 (default)]' )
				.action( _.bind( buildCommand, this, projectFilePath ) )

			commander
				.command( 'start-server' )
				.option( '-u, --user [username]', 'the user the server drops it\'s privileges to' )
				.option( '-p, --port [port number]', 'the port the server runs on' )
				.option( '-r, --projects-root [directory]', 'the path to the projects directory, that contains the project directories' )
				.description( 'start the dev server - run with superuser privileges to enable flash target support' )
				.action( startServerCommand )

			commander
				.command( 'init' )
				.description( 'initialize the current working directory with spell project scaffolding' )
				.action( _.bind( initCommand, this, spellPath, projectPath, projectFilePath ) )

			commander
				.command( 'info' )
				.description( 'print information about current environment' )
				.action( _.bind( infoCommand, this, spellPath, projectPath, projectFilePath ) )

			commander.parse( argv )
		}
	}
)
