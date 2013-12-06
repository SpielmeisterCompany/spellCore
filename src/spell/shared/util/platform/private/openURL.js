define(
	'spell/shared/util/platform/private/openURL',
	[
		'spell/shared/util/platform/private/environment/isHtml5Ejecta',
		'spell/shared/util/platform/private/environment/isHtml5Tizen'
	],
	function(
		isHtml5Ejecta,
	    isHtml5Tizen
	) {
		'use strict'


		return function( url, message ) {
			if( isHtml5Ejecta ) {
				ejecta.openURL( url, message )

			} else if( isHtml5Tizen ) {
				var appControl = new tizen.ApplicationControl(
					'http://tizen.org/appcontrol/operation/view',
					url
				)

				tizen.application.launchAppControl(
					appControl,
					null,
					function() { },
					function( e ) { }
				)

			} else {
				window.open( url, '_blank' )
			}
		}
	}
)
