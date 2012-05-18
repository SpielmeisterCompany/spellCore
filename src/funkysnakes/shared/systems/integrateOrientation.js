define(
	"funkysnakes/shared/systems/integrateOrientation",
	[
		'spell/shared/util/platform/underscore'
	],
	function(
		_
	) {
		"use strict"


		return function(
			deltaTimeInS,
			entities
		) {
			_.each( entities, function( entity ) {
				entity.orientation.angle += entity.angularFrequency.radPerS * deltaTimeInS
			} )
		}
	}
)
