define(
	'spell/system/render',
	[
		'spell/client/2d/graphics/drawCoordinateGrid',
		'spell/client/2d/graphics/physics/drawBox',
		'spell/client/2d/graphics/physics/drawCircle',
		'spell/client/2d/graphics/physics/drawPoint',
		'spell/client/2d/graphics/physics/drawOrigin',
		'spell/client/2d/graphics/drawShape',
		'spell/client/2d/graphics/drawText',
		'spell/client/2d/graphics/drawTitleSafeOutline',
		'spell/client/util/createEffectiveCameraDimensions',
		'spell/client/util/createIncludedRectangle',
		'spell/Defines',
		'spell/shared/util/platform/PlatformKit',

		'spell/math/util',
		'spell/math/vec2',
		'spell/math/vec4',
		'spell/math/mat3',

		'spell/functions'
	],
	function(
		drawCoordinateGrid,
		drawPhysicsBox,
		drawPhysicsCircle,
		drawPhysicsPoint,
		drawPhysicsOrigin,
		drawShape,
		drawText,
		drawTitleSafeOutline,
		createEffectiveCameraDimensions,
		createIncludedRectangle,
		Defines,
		PlatformKit,

		mathUtil,
		vec2,
		vec4,
		mat3,

		_
	) {
		'use strict'

        var COLOR_NORMALIZER = 255

		var tmpVec2           = vec2.create(),
			tmpVec2_1         = vec2.create(),
			tmpMat3           = mat3.identity( mat3.create() ),
			clearColor        = vec4.fromValues( 0, 0, 0, 1 ),
			unsafeAreaColor   = vec4.fromValues( 0, 0, 0, 1 ),
			debugFontAssetId  = 'font:spell.OpenSans14px',
			defaultDimensions = vec2.fromValues( 1.0, 1.0 ),
			tmpViewFrustum    = { bottomLeft : vec2.create(), topRight : vec2.create() },
			currentCameraId

//		var statisticsManager,
//			performance = window.performance

		var translateTextAppearance = function( spell, textAppearance ) {
            if( !textAppearance.translationAssetId ) {
                return
            }

			var text = spell.translate( textAppearance.translationAssetId, textAppearance.text )
			if( !text ) return

			textAppearance.renderText = text
		}

		var createOffset = function( deltaTimeInMs, offset, replaySpeed, numFrames, frameDuration, loop ) {
			var animationLengthInMs = numFrames * frameDuration,
				offsetInMs          = Math.floor( animationLengthInMs * offset ) + deltaTimeInMs * replaySpeed

			if( offsetInMs > animationLengthInMs ) {
				if( !loop ) return 1

				offsetInMs %= animationLengthInMs
			}

			return animationLengthInMs === 0 ?
				0 :
				offsetInMs / animationLengthInMs
		}

		var transformTo2dTileMapCoordinates = function( worldToLocalMatrix, tilemapDimensions, frameDimensions, maxTileMapY, point ) {
			var transformedPoint = vec2.divide(
				tmpVec2,
				vec2.transformMat3(
					tmpVec2,
					point,
					worldToLocalMatrix
				),
				frameDimensions
			)

			vec2.add(
				transformedPoint,
				vec2.scale( tmpVec2_1, tilemapDimensions, 0.5 ),
				transformedPoint
			)

			transformedPoint[ 1 ] = maxTileMapY - transformedPoint[ 1 ]

			return transformedPoint
		}

		var draw2dTileMap = function( context, texture, viewFrustum, asset, transform, worldToLocalMatrix ) {
			var tilemapData = asset.tilemapData

			if( !tilemapData ) return

			var assetSpriteSheet  = asset.spriteSheet,
				tilemapDimensions = asset.tilemapDimensions,
				frameOffsets      = assetSpriteSheet.frameOffsets,
				frameDimensions   = assetSpriteSheet.frameDimensions,
				maxTileMapX       = tilemapDimensions[ 0 ] - 1,
				maxTileMapY       = tilemapDimensions[ 1 ] - 1

			// transform the view frustum to tile map coordinates, clamp to effective range
			var lowerLeft = transformTo2dTileMapCoordinates(
                worldToLocalMatrix,
				tilemapDimensions,
				frameDimensions,
				maxTileMapY,
				viewFrustum.bottomLeft
			)

			var minTileMapSectionX = Math.max( Math.floor( lowerLeft[ 0 ] ), 0 ),
				maxTileMapSectionY = Math.min( Math.ceil( lowerLeft[ 1 ] ), maxTileMapY )

			var topRight = transformTo2dTileMapCoordinates(
                worldToLocalMatrix,
				tilemapDimensions,
				frameDimensions,
				maxTileMapY,
				viewFrustum.topRight
			)

			var minTileSectionMapY = Math.max( Math.floor( topRight[ 1 ] ), 0 ),
				maxTileSectionMapX = Math.min( Math.ceil( topRight[ 0 ] ), maxTileMapX )

			context.save()
			{
				context.scale( frameDimensions )

				for( var y = minTileSectionMapY; y <= maxTileMapSectionY; y++ ) {
					var tilemapRow = tilemapData[ y ]
					if( !tilemapRow ) continue

					for( var x = minTileMapSectionX; x <= maxTileSectionMapX; x++ ) {
						var frameId = tilemapRow[ x ]
						if( frameId === null ) continue

						tmpVec2[ 0 ] = x - maxTileMapX * 0.5 - 0.5
						tmpVec2[ 1 ] = ( maxTileMapY - y ) - maxTileMapY * 0.5 - 0.5

						context.drawSubTexture(
							texture,
							frameOffsets[ frameId ],
							frameDimensions,
							tmpVec2,
							defaultDimensions
						)
					}
				}
			}
			context.restore()
		}

        var worldToLocalMatrixCache = {}

		var drawVisualObject = function(
			entityManager,
			context,
			transforms,
			appearances,
			textureMatrices,
			animatedAppearances,
			textAppearances,
			tilemaps,
			spriteSheetAppearances,
			quadGeometries,
			visualObjects,
			rectangles,
			deltaTimeInMs,
			id,
			viewFrustum
		) {
			var tilemap      = tilemaps[ id ],
				appearance   = appearances[ id ] || animatedAppearances[ id ] || tilemap || textAppearances[ id ] || spriteSheetAppearances[ id ],
				transform    = transforms[ id ],
				visualObject = visualObjects[ id ],
				quadGeometry = quadGeometries[ id ]

			context.save()
			{
				if( transform ) {
					context.setTransform( transform.worldMatrix )
				}

				if( visualObject ) {
					var worldOpacity = visualObject.worldOpacity

					if( worldOpacity < 1.0 ) {
						context.setGlobalAlpha( worldOpacity )
					}

					var asset = appearance ? appearance.asset : undefined

					if( asset ) {
						var type    = asset.type,
                            texture = asset.resource

						if( !texture && type !== '2dTileMap' ) throw 'The resource id \'' + asset.resourceId + '\' could not be resolved.'

						if( type === 'appearance' ) {
							var textureMatrix  = textureMatrices[ id ],
								quadDimensions = quadGeometry ?
									quadGeometry.dimensions :
									texture.dimensions

//							var start = performance.now()

							// static appearance
							context.drawTexture(
								texture,
								vec2.scale( tmpVec2, quadDimensions, -0.5 ),
								quadDimensions,
								textureMatrix && !textureMatrix.isIdentity ?
									textureMatrix.matrix :
									undefined
							)

//							var elapsed = performance.now() - start

						} else if( type === 'font' ) {
//							var start = performance.now()

							// text appearance
							drawText(
								context,
								asset,
								texture,
								0.0,
								0.0,
								appearance.renderText || appearance.text,
								appearance.spacing,
								appearance.align
							)

//							var elapsed = performance.now() - start

						} else if( type === '2dTileMap' ) {
//							var start = performance.now()

                            texture = asset.spriteSheet.resource

                            if( !worldToLocalMatrixCache[ id ] ) {
                                worldToLocalMatrixCache[ id ] = mat3.create()
                                mat3.invert( worldToLocalMatrixCache[ id ], transform.worldMatrix )

                            }

							draw2dTileMap( context, texture, viewFrustum, asset, transform, worldToLocalMatrixCache[ id ] )

//							var elapsed = performance.now() - start

						} else if( type === 'animation' ) {
							// animated appearance

                            var assetNumFrames       = asset.numFrames,
                                wasPlaying           = appearance.playing

                            if( wasPlaying ) {
								if( appearance.offset == 0 ) {
									entityManager.triggerEvent( id, 'animationStart', [ 'animation', appearance ] )
								}

								appearance.offset = createOffset(
									deltaTimeInMs,
									appearance.offset,
									appearance.replaySpeed,
									assetNumFrames,
									asset.frameDuration,
									appearance.looped
								)
							}

                            var frameIndex                  = Math.round( appearance.offset * ( assetNumFrames - 1 ) ),
                                frameOffset                 = asset.frameOffsets[ frameIndex ],
                                frameTrimOffset             = asset.frameTrimOffset[ frameIndex ],
                                frameSourceDimensions       = asset.frameSourceDimensions[ frameIndex ],
                                frameDestinationDimensions  = asset.frameDestinationDimensions[ frameIndex ]

                            var quadDimensions = quadGeometry ?
                                quadGeometry.dimensions :
                                frameDestinationDimensions

                            tmpVec2[ 0 ] = frameTrimOffset[ 0 ] - ( quadDimensions[ 0 ] * 0.5 )
                            tmpVec2[ 1 ] = frameTrimOffset[ 1 ] - ( quadDimensions[ 1 ] * 0.5 )

                            context.drawSubTexture(
								texture,
								frameOffset,
                                frameSourceDimensions,
								tmpVec2, /* destinationPosition */
                                frameSourceDimensions
							)

                            var reachedEnd = appearance.offset >= 1,
								isPlaying  = wasPlaying && ( appearance.looped || !reachedEnd )

							if( isPlaying != wasPlaying ) {
								appearance.playing = isPlaying

								if( !isPlaying ) {
									entityManager.triggerEvent( id, 'animationEnd', [ 'animation', appearance ] )
								}
							}

						} else if( type === 'spriteSheet' ) {

                            if (asset.version != 1) {
                                throw 'Only supported for version 1 styleshets'
                            }

							var frameDimensions   = asset.frameDimensions,
								frameOffsets      = asset.frameOffsets,
								frames            = appearance.drawAllFrames ? _.keys( asset.frameOffsets ) : appearance.frames,
								frameOffset       = undefined,
								quadDimensions    = quadGeometry ? quadGeometry.dimensions :  [ ( frames.length -0 ) * frameDimensions[ 0 ], frameDimensions[ 1 ] ],
								numFramesInQuad   = [
									Math.floor( quadDimensions[ 0 ] / frameDimensions[ 0 ] ),
									Math.floor( quadDimensions[ 1 ] / frameDimensions[ 1 ] )
								],
								totalFramesInQuad = numFramesInQuad[ 0 ] * numFramesInQuad[ 1 ]

							if( totalFramesInQuad > 0 ) {
								// only draw spriteSheet if we have at least space to draw one tile

//								var start = performance.now()

								context.save()
								{
									context.scale( frameDimensions )

									for( var x = 0, length = frames.length; x < length && x < totalFramesInQuad; x++ ) {
										frameIndex     = frames[ x ]
										frameOffset = frameOffsets[ frameIndex ]

										tmpVec2[ 0 ] = -( quadDimensions[ 0 ] / frameDimensions[ 0 ] ) * 0.5 + x % numFramesInQuad[ 0 ]
										tmpVec2[ 1 ] = -( quadDimensions[ 1 ] / frameDimensions[ 1 ] ) * 0.5 + Math.floor( x / numFramesInQuad[ 0 ] )

										context.drawSubTexture(
											texture,
											frameOffset,
											frameDimensions,
											tmpVec2,
											defaultDimensions
										)
									}
								}
								context.restore()

//								var elapsed = performance.now() - start
							}
						}

//						statisticsManager.updateNode( 'platform drawing', elapsed )
					}

					var shape = rectangles[ id ]

					if( shape ) {
						drawShape.rectangle( context, shape )
					}
				}
			}
			context.restore()
		}

		var setCamera = function( context, cameraDimensions, position ) {
			// setting up the camera geometry
			var halfWidth  = cameraDimensions[ 0 ] * 0.5,
				halfHeight = cameraDimensions[ 1 ] * 0.5

			mathUtil.mat3Ortho( tmpMat3, -halfWidth, halfWidth, -halfHeight, halfHeight )

			// translating with the inverse camera position
			mat3.translate( tmpMat3, tmpMat3, vec2.negate( tmpVec2, position ) )

			context.setViewMatrix( tmpMat3 )
		}

		var initColorBuffer = function( context, screenDimensions ) {
			context.resizeColorBuffer( screenDimensions[ 0 ], screenDimensions[ 1 ] )
			context.viewport( 0, 0, screenDimensions[ 0 ], screenDimensions [ 1 ] )
		}

		var createViewFrustum = function( cameraDimensions, cameraTranslation ) {
			var halfCameraDimensions = vec2.scale( tmpVec2, cameraDimensions, 0.5 )

			vec2.subtract(
				tmpViewFrustum.bottomLeft,
				cameraTranslation,
				halfCameraDimensions
			)

			vec2.add(
				tmpViewFrustum.topRight,
				cameraTranslation,
				halfCameraDimensions
			)

			return tmpViewFrustum
		}

		var init = function( spell ) {
			var eventManager = this.eventManager

			this.screenResizeHandler = _.bind(
				function( size ) {
					this.screenSize = size
					initColorBuffer( this.context, size )
				},
				this
			)

			eventManager.subscribe( eventManager.EVENT.SCREEN_RESIZE, this.screenResizeHandler )


			this.cameraChangedHandler = _.bind(
				function( camera, entityId ) {
					 currentCameraId = camera.active ? entityId : undefined
				},
				this
			)

			eventManager.subscribe( [ eventManager.EVENT.COMPONENT_CREATED, Defines.CAMERA_COMPONENT_ID ], this.cameraChangedHandler )
			eventManager.subscribe( [ eventManager.EVENT.COMPONENT_UPDATED, Defines.CAMERA_COMPONENT_ID ], this.cameraChangedHandler )


			// HACK: textAppearances should get translated when they are created or when the current language is changed
			this.translateTextAppearanceHandler = _.bind(
				translateTextAppearance,
				null,
				spell
			)

			eventManager.subscribe( [ eventManager.EVENT.COMPONENT_CREATED, Defines.TEXT_APPEARANCE_COMPONENT_ID ], this.translateTextAppearanceHandler )
			eventManager.subscribe( [ eventManager.EVENT.COMPONENT_UPDATED, Defines.TEXT_APPEARANCE_COMPONENT_ID ], this.translateTextAppearanceHandler )

			if( this.config && this.config.clearColor ) {
				var cColor = this.config.clearColor
				clearColor = vec4.fromValues( cColor[0] / COLOR_NORMALIZER, cColor[1] / COLOR_NORMALIZER, cColor[2] / COLOR_NORMALIZER, 1 )
				this.context.setClearColor( clearColor )
			}

//			statisticsManager = spell.statisticsManager
//
//			statisticsManager.addNode( 'compiling entity list', 'spell.system.render' )
//			statisticsManager.addNode( '# entities drawn', 'spell.system.render' )

//			statisticsManager.addNode( 'drawing', 'spell.system.render' )
//			statisticsManager.addNode( 'sort', 'spell.system.render' )
//			statisticsManager.addNode( 'platform drawing', 'drawing' )
		}

		var destroy = function( spell ) {
			var eventManager = this.eventManager

			eventManager.unsubscribe( eventManager.EVENT.SCREEN_RESIZE, this.screenResizeHandler )
			eventManager.unsubscribe( [ eventManager.EVENT.COMPONENT_CREATED, Defines.CAMERA_COMPONENT_ID ], this.cameraChangedHandler )
			eventManager.unsubscribe( [ eventManager.EVENT.COMPONENT_UPDATED, Defines.CAMERA_COMPONENT_ID ], this.cameraChangedHandler )
			eventManager.unsubscribe( [ eventManager.EVENT.COMPONENT_CREATED, Defines.TEXT_APPEARANCE_COMPONENT_ID ], this.translateTextAppearanceHandler )
			eventManager.unsubscribe( [ eventManager.EVENT.COMPONENT_UPDATED, Defines.TEXT_APPEARANCE_COMPONENT_ID ], this.translateTextAppearanceHandler )

			this.context.clear()
		}

		var process = function( spell, timeInMs, deltaTimeInMs ) {
			var context                = this.context,
				screenSize             = this.screenSize,
				entityManager          = spell.entityManager,
				transforms             = this.transforms,
				appearances            = this.appearances,
				textureMatrices        = this.textureMatrices,
				animatedAppearances    = this.animatedAppearances,
				textAppearances        = this.textAppearances,
				tilemaps               = this.tilemaps,
				spriteSheetAppearances = this.spriteSheetAppearances,
				quadGeometries         = this.quadGeometries,
				visualObjects          = this.visualObjects,
				rectangles             = this.rectangles,
				viewFrustum

			spell.visibilityManager.updateVisibility( spell )

			// clear color buffer
			context.clear()

			// set the camera
			var camera          = this.cameras[ currentCameraId ],
				cameraTransform = transforms[ currentCameraId ]

			if( !camera || !cameraTransform ) {
				throw 'No valid camera available.'
			}


			var aspectRatio               = screenSize[ 0 ] / screenSize[ 1 ],
				effectiveCameraDimensions = createEffectiveCameraDimensions( camera.width, camera.height, cameraTransform.scale, aspectRatio )

			viewFrustum = createViewFrustum( effectiveCameraDimensions, cameraTransform.translation )


			// draw visual objects in background pass
			setCamera( context, effectiveCameraDimensions, [ 0, 0 ] )

			for( var i = 0, n = spell.visibilityManager.backgroundPassEntities.length; i < n; i++ ) {
				drawVisualObject(
					entityManager,
					context,
					transforms,
					appearances,
					textureMatrices,
					animatedAppearances,
					textAppearances,
					tilemaps,
					spriteSheetAppearances,
					quadGeometries,
					visualObjects,
					rectangles,
					deltaTimeInMs,
					spell.visibilityManager.backgroundPassEntities[ i ][ 'id' ],
					viewFrustum
				)
			}


			// draw visual objects in world pass
			context.save()
			{
				setCamera( context, effectiveCameraDimensions, cameraTransform.translation )

				for( var i = 0, n = spell.visibilityManager.worldPassEntitiesLength; i < n; i++ ) {
					drawVisualObject(
						entityManager,
						context,
						transforms,
						appearances,
						textureMatrices,
						animatedAppearances,
						textAppearances,
						tilemaps,
						spriteSheetAppearances,
						quadGeometries,
						visualObjects,
						rectangles,
						deltaTimeInMs,
						spell.visibilityManager.worldPassEntities[ i ][ 'id' ],
						viewFrustum
					)
				}

                spell.physicsManager.debugDrawHook( spell.renderingContext, [ viewFrustum.bottomLeft[0], viewFrustum.bottomLeft[1], viewFrustum.topRight[0], viewFrustum.topRight[1] ] )
			}
			context.restore()


			// draw visual objects in ui pass
			setCamera( context, effectiveCameraDimensions, [ 0, 0 ] )

			for( var i = 0, n = spell.visibilityManager.uiPassEntities.length; i < n; i++ ) {
				drawVisualObject(
					entityManager,
					context,
					transforms,
					appearances,
					textureMatrices,
					animatedAppearances,
					textAppearances,
					tilemaps,
					spriteSheetAppearances,
					quadGeometries,
					visualObjects,
					rectangles,
					deltaTimeInMs,
					spell.visibilityManager.uiPassEntities[ i ][ 'id' ],
					viewFrustum
				)
			}

			context.flush()

			setCamera( context, effectiveCameraDimensions, cameraTransform.translation )

			// clear unsafe area
			if( camera &&
				camera.clearUnsafeArea &&
				cameraTransform ) {

				var cameraDimensions             = [ camera.width, camera.height ],
					scaledCameraDimensions       = vec2.multiply( tmpVec2, cameraDimensions, cameraTransform.scale ),
					cameraAspectRatio            = scaledCameraDimensions[ 0 ] / scaledCameraDimensions[ 1 ],
					effectiveTitleSafeDimensions = createIncludedRectangle( screenSize, cameraAspectRatio, true )

				vec2.scale(
					tmpVec2,
					vec2.subtract( tmpVec2, screenSize, effectiveTitleSafeDimensions ),
					0.5
				)

				var offset = tmpVec2

				offset[ 0 ] = Math.round( offset[ 0 ] )
				offset[ 1 ] = Math.round( offset[ 1 ] )

				context.save()
				{
					// world to view matrix
					mathUtil.mat3Ortho( tmpMat3, 0, screenSize[ 0 ], 0, screenSize[ 1 ] )
					context.setViewMatrix( tmpMat3 )

					context.setColor( unsafeAreaColor )

					if( offset[ 0 ] > 0 ) {
						context.fillRect( 0, 0, offset[ 0 ], screenSize[ 1 ] )
						context.fillRect( screenSize[ 0 ] - offset[ 0 ], 0, offset[ 0 ], screenSize[ 1 ] )

					} else if( offset[ 1 ] > 0 ) {
						context.fillRect( 0, 0, screenSize[ 0 ], offset[ 1 ] )
						context.fillRect( 0, screenSize[ 1 ] - offset[ 1 ], screenSize[ 0 ], offset[ 1 ] )
					}
				}
				context.restore()
			}

			if( this.isDevelopment &&
				effectiveCameraDimensions &&
				cameraTransform ) {

				context.save()
				{
					if( this.configurationManager.getValue( 'drawCoordinateGrid' ) ) {
						drawCoordinateGrid( context, this.debugFontAsset, screenSize, effectiveCameraDimensions, cameraTransform )
					}

					if( this.configurationManager.getValue( 'drawTitleSafeOutline' ) ) {
						drawTitleSafeOutline( context, screenSize, [ camera.width, camera.height ], cameraTransform )
					}
				}
				context.restore()
			}

//			var elapsed = performance.now() - start

//			spell.statisticsManager.updateNode( 'drawing', elapsed )
		}


		var Render = function( spell ) {
			this.configurationManager = spell.configurationManager
			this.context              = spell.renderingContext
			this.eventManager         = spell.eventManager
			this.debugFontAsset       = spell.assetManager.get( debugFontAssetId )
			this.screenSize           = spell.configurationManager.getValue( 'currentScreenSize' )
			this.isDevelopment        = spell.configurationManager.getValue( 'mode' ) !== 'deployed'

			// world to view matrix
			mathUtil.mat3Ortho( tmpMat3, 0.0, this.screenSize[ 0 ], 0.0, this.screenSize[ 1 ] )
			this.context.setViewMatrix( tmpMat3 )

			this.context.setClearColor( clearColor )
			initColorBuffer( this.context, this.screenSize )
		}

		Render.prototype = {
			init : init,
			destroy : destroy,
			activate : function( spell ) {},
			deactivate : function( spell ) {},
			process : process
		}

		return Render
	}
)
