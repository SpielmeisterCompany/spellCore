/**
 * @class spell.system.physics
 * @singleton
 */

define(
    'spell/system/physics',
    [
		'spell/math/vec2',

        'spell/Defines',
        'spell/functions'
    ],
    function(
		vec2,

        Defines,
        _
    ) {
        'use strict'

        /**
         * Creates an instance of the system.
         *
         * @constructor
         * @param {Object} [spell] The spell object.
         */
        var physics = function( spell ) {
            this.entityCreatedHandler
            this.entityDestroyHandler
            this.world
            this.removedEntitiesQueue = []
        }

		var constraintsToCreate = []

        var triggerContactEntityEvent = function( entityManager, eventId, shapeA, arbiter, shapeB, params ) {
			var entityIdA = shapeA.body.userData,
				entityIdB = shapeB.body.userData

            var fixtureA = entityManager.getComponentById(
                entityIdA,
                Defines.PHYSICS_FIXTURE_COMPONENT_ID
            )

            var fixtureB = entityManager.getComponentById(
                entityIdB,
                Defines.PHYSICS_FIXTURE_COMPONENT_ID
            )

            var bodyA = entityManager.getComponentById(
                entityIdA,
                Defines.PHYSICS_BODY_COMPONENT_ID
            )

            var bodyB = entityManager.getComponentById(
                entityIdB,
                Defines.PHYSICS_BODY_COMPONENT_ID
            )

            if( fixtureA && fixtureB && bodyA && bodyB ) {
                entityManager.triggerEvent( entityIdA, eventId, [ entityIdB, arbiter, bodyA, bodyB, fixtureA, fixtureB ].concat( params ) )
            }
        }

        var createContactListener = function( entityManager, shape, contactTrigger ) {

            shape.addEventListener(
                'begin', function( arbiter, otherShape ) {
                    triggerContactEntityEvent( entityManager, 'beginContact', this, arbiter, otherShape, [] )

                    if( contactTrigger && contactTrigger.eventId ) {
                        var params           = contactTrigger.parameters,
                            normalizedParams = !params ? [] : _.isArray( params ) ? params : _.isString( params ) ? params.split(',') : [ params ]

                        triggerContactEntityEvent( entityManager, contactTrigger.eventId, this, arbiter, otherShape, normalizedParams )
                    }
                }
            )

            shape.addEventListener(
                'end', function( arbiter, otherShape ) {
                    triggerContactEntityEvent( entityManager, 'endContact', this, arbiter, otherShape, [] )
                }
            )

            shape.addEventListener(
                'preSolve', function( arbiter, otherShape ) {
					//In turblenz the presolve wont have this bound to a shape. We need to validate if the shapes from the arbiter can always be used
                    triggerContactEntityEvent( entityManager, 'preSolve', arbiter.shapeA, arbiter, arbiter.shapeB, [] )
                }
            )

            shape.addEventListener(
                'progress', function( arbiter, otherShape ) {
                    triggerContactEntityEvent( entityManager, 'progress', this, arbiter, otherShape, [] )
                }
            )
        }


        var createJNRPlayerBody = function( physicsManager, shapeDef, JNRunPlayerShape ) {
            var radius = JNRunPlayerShape.dimensions[ 0 ] * 0.9,
                width  = JNRunPlayerShape.dimensions[ 0 ] * 0.7,
                sensorHeight = 5,
                height = JNRunPlayerShape.dimensions[ 0 ],
                sensorWidth = width * 0.3,
                shapes = [
                    physicsManager.createPolygonShape(
                        _.extend(
                            {},
                            shapeDef,
                            {
                                vertices: [
                                    [ -width, height ],
                                    [ -width, height + sensorHeight ],
                                    [ -width + sensorWidth, height + sensorHeight ],
                                    [ -width + sensorWidth, height ]
                                ],
                                group: 0x0500,
                                mask: 0xFFFF,
                                sensor: true
                            }
                        )
                    ),
                    physicsManager.createPolygonShape(
                        _.extend(
                            {},
                            shapeDef,
                            {
                                vertices: [
                                    [ -sensorWidth, height ],
                                    [ -sensorWidth, height + sensorHeight ],
                                    [ sensorWidth, height + sensorHeight ],
                                    [ sensorWidth, height ]
                                ],
                                group: 0x0500,
                                mask: 0xFFFF,
                                sensor: true
                            }
                        )
                    ),
                    physicsManager.createPolygonShape(
                        _.extend(
                            {},
                            shapeDef,
                            {
                                vertices: [
                                    [ width - sensorWidth, height ],
                                    [ width - sensorWidth, height + sensorHeight ],
                                    [ width, height + sensorHeight ],
                                    [ width, height ]
                                ],
                                group: 0x0500,
                                mask: 0xFFFF,
                                sensor: true
                            }
                        )
                    ),
	                physicsManager.createCircleShape(
                        _.extend(
                            {},
                            shapeDef,
                            {
                                radius: radius,
                                group: 0x0900,
                                mask: 0xFFFF
                            }
                        )
                    ),
                    physicsManager.createPolygonShape(
                        _.extend(
                            {},
                            shapeDef,
                            {
                                vertices: [
                                    [ -width, -height ],
                                    [ -width, -height - sensorHeight ],
                                    [ -width + sensorWidth, -height - sensorHeight ],
                                    [ -width + sensorWidth, -height ]
                                ],
                                group: 0x0300,
                                mask: 0xFFFF,
                                sensor: true
                            }
                        )
                    ),
                    physicsManager.createPolygonShape(
                        _.extend(
                            {},
                            shapeDef,
                            {
                                vertices: [
                                    [ -sensorWidth, -height ],
                                    [ -sensorWidth, -height - sensorHeight ],
                                    [ sensorWidth, -height - sensorHeight ],
                                    [ sensorWidth, -height ]
                                ],
                                group: 0x0300,
                                mask: 0xFFFF,
                                sensor: true
                            }
                        )
                    ),
                    physicsManager.createPolygonShape(
                        _.extend(
                            {},
                            shapeDef,
                            {
                                vertices: [
                                    [ width - sensorWidth, -height ],
                                    [ width - sensorWidth, -height - sensorHeight ],
                                    [ width, -height - sensorHeight ],
                                    [ width, -height ]
                                ],
                                group: 0x0300,
                                mask: 0xFFFF,
                                sensor: true
                            }
                        )
                    )
                ]


            return shapes
        }

		var checkForConstraints = function( entityId, entity ) {
			var weldConstraint  = entity[ 'spell.component.physics.constraint.weld' ],
				pointConstraint = entity[ 'spell.component.physics.constraint.point' ],
				angleConstraint = entity[ 'spell.component.physics.constraint.angle' ]

			if( weldConstraint ) {
				constraintsToCreate.push( { type: 'weld', entityId: entityId, constraint: weldConstraint } )
			}

            if( pointConstraint ) {
				constraintsToCreate.push( { type: 'point', entityId: entityId, constraint: pointConstraint } )
			}

            if( angleConstraint ) {
				constraintsToCreate.push( { type: 'angle', entityId: entityId, constraint: angleConstraint } )
			}
		}

		var createConstraints = function( entityManager, physicsManager, world ) {
			for( var i = 0; i < constraintsToCreate.length; i ++ ) {
				var constraintConfig = constraintsToCreate[ i ],
					entityId         = constraintConfig.entityId,
					type             = constraintConfig.type,
					constraint       = constraintConfig.constraint

				var otherEntityId = entityManager.getEntityIdsByName( constraint.otherEntity )

                //TODO: find a solution for mutliple existenz of entity names
				if( otherEntityId ) {
                    if( otherEntityId.length > 1 ) {
                        otherEntityId = entityManager.getEntityIdsByName( constraint.otherEntity, entityId )

                        if( !otherEntityId || otherEntityId.length > 1 ) {
                            throw "OtherEntity '" + constraint.otherEntity +"' in the constraint isn't unique!"
                        }
                    }

					var config = _.extend(
						{
							stiff : true,
							frequency : 10,
							damping : 1,
							removeOnBreak : true,
							breakUnderForce : false,
							breakUnderError : false,
							ignoreInteractions : false,
							sleeping : false,
							disabled : false
						},
						constraint,
						{ entityA: otherEntityId[0], entityB: entityId }
					)

					if( type === 'point' ) {
						constraint = physicsManager.createPointConstraint( config )

					} else if( type === 'weld' ) {
						constraint = physicsManager.createWeldConstraint( config )

					} else if( type === 'angle' ) {
						constraint = physicsManager.createAngleConstraint( config )
					}

					world.addConstraint( constraint )
				} else {
					throw "OtherEntity '" + constraint.otherEntity +"' in the constraint isn't existing!"
				}
			}

			constraintsToCreate.length = 0
		}

        var createBody = function( entityManager, physicsManager, world, entityId, entity ) {
            var body               = entity[ Defines.PHYSICS_BODY_COMPONENT_ID ],
                fixture            = entity[ Defines.PHYSICS_FIXTURE_COMPONENT_ID ],
                boxShape           = entity[ Defines.PHYSICS_BOX_SHAPE_COMPONENT_ID ],
                circleShape        = entity[ Defines.PHYSICS_CIRCLE_SHAPE_COMPONENT_ID ],
                convexPolygonShape = entity[ Defines.PHYSICS_CONVEX_POLYGON_SHAPE_COMPONENT_ID ],
                JNRunPlayerShape   = entity[ Defines.PHYSICS_JNRPLAYER_SHAPE_COMPONENT_ID ],
                transform          = entity[ Defines.TRANSFORM_COMPONENT_ID ],
                contactTrigger     = entity[ Defines.PHYSICS_CONTACT_TRIGGER_COMPONENT_ID ]

            if( !body || !fixture || !transform ||
                ( !boxShape && !circleShape && !convexPolygonShape && !JNRunPlayerShape ) ) {

                return
            }

            var shapeDef = {
                    material : physicsManager.createMaterial({
                        elasticity : fixture.elasticity,
                        staticFriction : fixture.staticFriction,
                        dynamicFriction : fixture.dynamicFriction,
                        rollingFriction : fixture.rollingFriction,
                        density: fixture.density
                    }),
                    group: fixture.categoryBits,
                    mask: fixture.maskBits,
                    sensor: fixture.isSensor
                },
                shapes = []

            if( JNRunPlayerShape ) {
                shapes = createJNRPlayerBody( physicsManager, shapeDef, JNRunPlayerShape )

            } else {
                if( circleShape ) {
                    shapeDef.radius = circleShape.radius
                    shapes.push( physicsManager.createCircleShape( shapeDef ) )

                } else {
                    shapeDef.vertices = boxShape ? physicsManager.createBoxVertices(
                        boxShape.dimensions[ 0 ],
                        boxShape.dimensions[ 1 ]
                    ): convexPolygonShape.vertices

                    shapes.push( physicsManager.createPolygonShape( shapeDef ) )
                }
            }

            _.each(
                shapes,
                function( shape ) {
                    createContactListener( entityManager, shape, contactTrigger )
                }
            )

            physicsManager.createBodyDef( entityId, body, shapes, transform )

			checkForConstraints( entityId, entity )
        }


        var destroyBodies = function( world, entityIds ) {
            for( var i = 0, numEntityIds = entityIds.length; i < numEntityIds; i++ ) {
                world.destroyBody( entityIds[ i ] )
            }
        }

		var isVec2Equal = function( vector1, vector2 ) {
			return vector1[0] == vector2[0] && vector1[1] == vector2[1]
		}

		var tmpVec2 = vec2.create()

        var iterateRigidBodies = function( entityManager, rigidBodies, bodies, transforms ) {
            var length       = rigidBodies.length,
                rigidBody, id, body, transform

            for( var i = 0; i < length; i++ ) {
                rigidBody = rigidBodies[ i ]
                id        = rigidBody.userData
                body      = bodies[ id ]

                // transfering state to components
                transform = transforms[ id ]

                if( !transform ) continue

				var translation      = transform.translation,
					worldTranslation = transform.worldTranslation,
					position         = rigidBody.getPosition()

				if( !isVec2Equal( translation, worldTranslation ) ) {
					vec2.subtract( tmpVec2, position, worldTranslation )
					vec2.add( position, translation, tmpVec2 )
				}

				transform.translation = position
                transform.rotation = rigidBody.getRotation()
                rigidBody.getVelocity( body.velocity )

                entityManager.updateWorldTransform( id )
            }
        }

        var incrementState = function( entityManager, world, bodies, transforms ) {
            iterateRigidBodies( entityManager, world.liveDynamics, bodies, transforms )
            iterateRigidBodies( entityManager, world.liveKinematics, bodies, transforms )
        }

        physics.prototype = {
            /**
             * Gets called when the system is created.
             *
             * @param {Object} [spell] The spell object.
             */
            init: function( spell ) {
                this.world = spell.physicsManager.getWorld()
                var config = this.config

                if( !this.world ) {
                    var world = spell.physicsManager.createWorld( this.config.gravity, this.config.scale, this.config.velocityIterations, this.config.positionIterations )

                    this.world = world
                }

                spell.physicsManager.setDebugDrawOptions({
	                showConstraints     : config.showConstraints,
                    showContacts        : config.showContacts,
                    showContactImpulses : config.showContactImpulses,
                    showRigidBodies     : config.showRigidBodies,
                    showColliderShapes  : config.showColliderShapes,
                    showSensorShapes    : config.showSensorShapes,
                    showBodyDetail      : config.showBodyDetail,
                    showShapeDetail     : config.showShapeDetail
                })

                this.entityCreatedHandler = _.bind( createBody, null, spell.entityManager, spell.physicsManager, this.world )
                this.entityDestroyHandler = _.bind( this.removedEntitiesQueue.push, this.removedEntitiesQueue )

                var eventManager = spell.eventManager

                eventManager.subscribe( eventManager.EVENT.ENTITY_CREATED, this.entityCreatedHandler )
                eventManager.subscribe( eventManager.EVENT.ENTITY_REMOVED, this.entityDestroyHandler )
            },

            /**
             * Gets called when the system is destroyed.
             *
             * @param {Object} [spell] The spell object.
             */
            destroy: function( spell ) {
                var eventManager = spell.eventManager

		        spell.physicsManager.clear()
	            spell.physicsManager.setDebugDrawOptions({
		            showConstraints     : false,
		            showContacts        : false,
		            showContactImpulses : false,
		            showRigidBodies     : false,
		            showColliderShapes  : false,
		            showSensorShapes    : false,
		            showBodyDetail      : false,
		            showShapeDetail     : false
	            })

                eventManager.unsubscribe( eventManager.EVENT.ENTITY_CREATED, this.entityCreatedHandler )
                eventManager.unsubscribe( eventManager.EVENT.ENTITY_REMOVED, this.entityDestroyHandler )
            },

            /**
             * Gets called when the system is activated.
             *
             * @param {Object} [spell] The spell object.
             */
            activate: function( spell ) {

            },

            /**
             * Gets called when the system is deactivated.
             *
             * @param {Object} [spell] The spell object.
             */
            deactivate: function( spell ) {

            },

            /**
             * Gets called to trigger the processing of game state.
             *
             * @param {Object} [spell] The spell object.
             * @param {Object} [timeInMs] The current time in ms.
             * @param {Object} [deltaTimeInMs] The elapsed time in ms.
             */
            process: function( spell, timeInMs, deltaTimeInMs ) {
                var physicsManager       = spell.physicsManager,
                    transforms           = this.transforms,
                    removedEntitiesQueue = this.removedEntitiesQueue

                if( removedEntitiesQueue.length ) {
                    destroyBodies( physicsManager, removedEntitiesQueue )
                    removedEntitiesQueue.length = 0
                }

				createConstraints( spell.entityManager, physicsManager, this.world )

				physicsManager.step( deltaTimeInMs * 0.001 )
                incrementState( spell.entityManager, this.world, this.bodies, transforms )
            }
        }

        return physics
    }
)
