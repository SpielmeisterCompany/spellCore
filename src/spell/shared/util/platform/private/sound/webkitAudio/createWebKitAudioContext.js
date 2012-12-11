define(
	'spell/shared/util/platform/private/sound/webkitAudio/createWebKitAudioContext',
	[
		'spell/functions'
	],
	function(
		_
		) {
		'use strict'


		/*
		 * private
		 */
		var context,
			sourcesNodes = {},
			isMutedValue = false,
			soundCounter = 0

		var create = function( id, audioResource ) {
			var gainNode   = context.createGainNode(),
				sourceNode = context.createBufferSource()

			sourceNode.buffer = audioResource.privateAudioResource

			sourceNode.connect( gainNode )
			gainNode.connect( context.destination )

			sourcesNodes[id] = sourceNode
			return sourceNode
		}

		/**
		 *
		 * @param audioResource
		 * @param id
		 * @param volume
		 * @param loop
		 */
		var play = function( audioResource, id, volume, loop ) {
			id = ( id ) ? id : "tmp_sound_" + soundCounter++
			var sourceNode = ( _.has( sourcesNodes, id ) ) ? sourcesNodes[id] : create( id, audioResource )

			setLoop( id, loop )
			setVolume( id, volume )

			if( isMuted() ) mute( id )

			if( sourceNode.playbackState !== sourceNode.PLAYING_STATE ) sourceNode.noteOn( 0 )
		}

		var stopAll = function() {
			_.each( sourcesNodes, function( value, key ) {
				mute( key )
			} )
		}

		var resumeAll = function() {
			_.each( sourcesNodes, function( value, key ) {
				setVolume( key, 1 )
			} )
		}

		var stop = function( id ) {
			var sourceNode = sourcesNodes[ id ]
			if( sourceNode ) sourceNode.noteOff(0)
		}

		var setVolume = function ( id, volume ) {
			volume = ( !isNaN(volume) ) ? volume : 1
			var sourceNode = sourcesNodes[ id ]
			if( sourceNode ) sourceNode.gain.value = volume
		}

		var setLoop = function( id, loop ) {
			loop = !!loop
			var sourceNode = sourcesNodes[ id ]
			if( sourceNode ) sourceNode.loop = loop
		}

		var mute = function( id ) {
			var sourceNode = sourcesNodes[ id ]
			if( sourceNode ) sourceNode.gain.value = 0
		}

		var destroy = function( id ) {
			stop( id )

			sourcesNodes[ id ] = null
			delete sourcesNodes[ id ]
		}

		/*
		 * Returns a audio context. Once a context has been created additional calls to this method return the same context instance.
		 *
		 * @param sound - the audio element
		 */
		var createAudioContext = function() {
			if( context !== undefined ) return context


			context = new webkitAudioContext()

			if( context === null ) return null


			return createWrapperContext()
		}

		/**
		 * Looks through the sourcesNodes and cleans up finished nodes
		 */
		var tick = function() {
			for( var id in sourcesNodes ) {
				var sourceNode = sourcesNodes[ id ]

				if( sourceNode.playbackState === sourceNode.FINISHED_STATE ) {
					destroy( id )
				}
			}
		}

		var setMute = function( isMute ) {
			if( isMute === true ) {
				_.each( sourcesNodes, function( value, key ) {
					mute( key )
				} )
			} else {
				_.each( sourcesNodes, function( value, key ) {
					setVolume( key, 1 )
				} )
			}

			isMutedValue = isMute
		}

		var isMuted = function() {
			return isMutedValue
		}

		/*
		 * Creates a wrapper context from the backend context.
		 */
		var createWrapperContext = function() {
			return {
				tick        : tick,
				play        : play,
				setLoop     : setLoop,
				setVolume   : setVolume,
				setAllMuted : setMute,
				isAllMuted  : isMuted,
				stop        : stop,
				mute        : mute,
				destroy     : destroy,
				createSound : createSound,
				stopAll     : stopAll,
				resumeAll   : resumeAll
			}
		}

		/*
		 * public
		 */

		/*
		 * Returns instance of audio class
		 *
		 * @param audioBuffer
		 */
		var createSound = function( audioBuffer ) {
			return {
				/*
				 * Public
				 */
				duration : audioBuffer.duration,

				/*
				 * Private
				 *
				 * This is an implementation detail of the class. If you write code that depends on this you better know what you are doing.
				 */
				privateAudioResource : audioBuffer
			}
		}

		return createAudioContext
	}
)