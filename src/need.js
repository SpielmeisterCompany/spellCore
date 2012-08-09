/**
 * need.js - A requiresque require.js replacement for usage in browsers.
 */

( function( document ) {
	var modules = {}

	var createScriptNode = function( name, source ) {
		var script = document.createElement( 'script' )
		script.type = 'text/javascript'
		script.text = source

		var head = document.getElementsByTagName( 'head' )[ 0 ]
		head.appendChild( script )
	}

	var loadModule = function( name ) {
		var moduleUrl = 'library/scripts/' + name + '.js'

		var request = new XMLHttpRequest()
		request.open( 'GET', moduleUrl, false )
		request.send( null )

		if( request.status !== 200 ) throw 'Error: Loading \'' + moduleUrl + '\' failed.'

		createScriptNode( name, request.responseText )

		return modules[ name ]
	}

	var createModule = function( name, args ) {
		var module = loadModule( name )

		if( !module ) throw 'Error: Could not load module \'' + name + '\'.'

		modules[ name ] = module

		return module
	}

	var createModuleInstance = function( dependencies, body, config ) {
		var args = []

		if( dependencies ) {
			for( var i = 0; i < dependencies.length; i++ ) {
				var dependencyModuleName = dependencies[ i ],
					dependencyModule = modules[ dependencyModuleName ]

				if( !dependencyModule ) {
					dependencyModule = createModule( dependencyModuleName )
				}

				if( !dependencyModule.instance ) {
					dependencyModule.instance = createModuleInstance( dependencyModule.dependencies, dependencyModule.body )
				}

				args.push( dependencyModule.instance )
			}
		}

		if( config ) args.push( config )

		return body.apply( null, args )
	}


	var define = function( name ) {
		var numArguments = arguments.length

		if( numArguments < 2 ||
			numArguments > 3 ) {

			throw 'Error: Module definition is invalid.'
		}

		modules[ name ] = {
			body         : ( numArguments === 2 ? arguments[ 1 ] : arguments[ 2 ] ),
			dependencies : ( numArguments === 2 ? undefined : arguments[ 1 ] )
		}
	}


	var require = function( moduleName, args ) {
		if( !moduleName ) throw 'Error: No module name provided.'

		var module = modules[ moduleName ]

		if( !module ) {
			module = createModule( moduleName, args )
		}

		if( !module.instance ) {
			module.instance = createModuleInstance( module.dependencies, module.body, args )
		}

		return module.instance
	}

	window.define  = define
	window.require = require
} )( document )
