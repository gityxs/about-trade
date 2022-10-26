/*
    Defines ri-graph directive
    - display nodes
    - handle ground click
    - display ghost node helper
    - display node status icon
*/


angular.module('ri.graph', [])

.directive('riNode', [function() {
    return {
        restrict: 'E',
        scope : {
            'node' : '='
        },
        link : function(scope, element, attrs) {
            var viewBoxSize = scope.node.size*2 + 10;
                var svg = d3.select(element[0])
                            .append("svg")
                                .attr("viewBox", "0 0 "+(viewBoxSize)+" "+(viewBoxSize))
                                .style({
                                    'width' : '100%'
                                })
            var nodeGroup = svg.append('g')
                                .attr('class', 'node')
                                .attr('transform', 'translate('+[viewBoxSize/2,viewBoxSize/2]+')');
            scope.node.svgViewEnter(nodeGroup);

            scope.$watch('node.updatetime', function(newVals, oldVals) {
                scope.node.svgViewUpdate(nodeGroup);
            }, false);
        }
    }
}])

.directive('riGraph', [function() {
    return {
        restrict: 'EA',
        scope: {
            'conf' : '=',
            'nodes' : '=',
            'model' : '=',
            'state' : '=',
            'agents' : '=',
            'links' : '=',
            'onclickGround' : '&',
            'onhoverNode' : '&',
            'onclickNode' : '&',
            'api' : '='
        },
        link: function(scope, element, attrs) {

            /*
             * INIT
             */

            var viewBoxSize = 500;
            //var mode = "BUILD"
            var svg = d3.select(element[0])
                        .append("svg")
                            .attr("viewBox", (-viewBoxSize/2)+" "+(-viewBoxSize/2)+" "+(viewBoxSize)+" "+(viewBoxSize))
                            .style({
                                'width' : '100%'
                            })
/*            var svg = d3.select(element[0])
                        .append("svg")
                            .attr("viewBox", (-viewBoxSize/2)+" "+(-viewBoxSize/2)+" "+(viewBoxSize)+" "+(viewBoxSize))
                            //.attr("preserveAspectRatio", "xMidYMid meet")
                            .style({
                                'width' : '100vw',
                                'height' : '100vh',
                                'background-color' : 'lightgreen'
                            })*/

            var defs = svg.append('defs');
            var gridSquareSize = 30;
            defs.append('pattern')
                    .attr({
                        'id' : 'grid-pattern',
                        'width' : gridSquareSize,
                        'height' : gridSquareSize,
                        'patternUnits' : 'userSpaceOnUse'
                    })
                    .append('path')
                        .attr({
                            'd' : "M 0 0 L "+gridSquareSize+" 0 "+gridSquareSize+" "+gridSquareSize+" 0 "+gridSquareSize+" z",
                            'stroke' : 'white',
                            'stroke-width'  : 1,
                            'fill' : '#f5f5f5'
                        })
/*            defs.append('pattern')
                    .attr({
                        'id' : 'hexa-pattern',
                        'width' : 56,
                        'height' : 100,
                        'patternUnits' : 'userSpaceOnUse'
                    })
                    .append('path')
                        .attr({
                            'd' : 'M28 66L0 50L0 16L28 0L56 16L56 50L28 66L28 100',
                            'stroke' : 'white',
                            'stroke-width'  : 1,
                            'fill' : '#f5f5f5'
                        })*/


            var world = svg.append('g');
            world.append('circle')
                .attr({
                    'id' : 'world-ground'
                })
                .style('fill', 'url(#grid-pattern)')

            scope.$watch('conf', function(conf) {
                d3.select('#world-ground')
                    .attr('r',conf.mapSize/2)
            }, true)

            // Zoom / Pan
            var zoom = d3.behavior.zoom()
                .scaleExtent([0.2, 1])
                //.scale(0.12)
                .on("zoom", zoomed);
            svg.call(zoom);
            //zoomed();

            function zoomed(animate) {
                world.attr("transform", "translate(" + zoom.translate() + ")scale(" + zoom.scale() + ")");
            }

            var selector = world.append('g').attr('id', 'selectednode-indicator');
            selector.append('circle');
            selector.append('circle');
            var linkLayer = world.append('g');
            var nodeLayer = world.append('g');
            var agentLayer = world.append('g');
            var ghostNode = world.append('g').attr('class', 'ghost').style('pointer-events', 'none');
            var routeLayer = world.append('g').style('pointer-events', 'none');
            ghostNode.append('circle')
                .attr('class', 'center');
            ghostNode.append('circle')
                .attr('class', 'area');


                        /*
             * API
             */
             scope.api = {
                clear: function() {
                    [linkLayer, nodeLayer, agentLayer, routeLayer].forEach(function(layer) {
                        layer.selectAll('*').remove();
                    })
                }
             }

            /*
             * Watch changes
             */

            scope.$watch('model', function(newVals, oldVals) {
                ghostNode.style('opacity', newVals?1:0)
                nodeLayer.selectAll('.node').classed('highlighted', newVals)//.style('visibility', newVals?'visible':'hidden')
                if (newVals) {
                    ghostNode.select('.center').attr('r', newVals.node.size);
                    ghostNode.select('.area').attr('r', newVals.node.areaRadius);
                }
            }, true);

            // watch for data changes and re-render
            scope.$watch('nodes', function(newVals, oldVals) {
                scope.render();
            }, true);

            scope.$watch('state.selectedRoute.updatetime', function(newVals, oldVals) {
                renderRoute(scope.state.selectedRoute);
            }, false);

            scope.$watch('state.selectedNode', function(node) {
                if (node) {
                    selector
                        .attr('display', 'initial')
                        .attr('transform', 'translate('+[node.pos.x, node.pos.y]+')')
                        .selectAll('circle').attr('r', function(d,i) {return node.size + 12 + 5*i})
                } else {
                    selector
                        .attr('display', 'none')
                }
            }, false);


            scope.$watch('links.updatetime', function(newVals, oldVals) {
                renderLinks();
            }, false);

            // TODO watch update time instead of agents array, it causes render at each step
            // because market is linked to agents and changes every time
            scope.$watch('agents', function(newVals, oldVals) {
                //console.log('RENDER AGENT')
                renderAgents();
            }, true);

            /*
             * INPUTS
             */

            world.on('click', function() {
                var point = d3.mouse(this),
                    p = {x: point[0], y: point[1] };
                scope.onclickGround({pos:p});
            })

            world.on('mousemove', function() {
                if (!scope.model) {return}

                var point = d3.mouse(this),
                    pos = {x:point[0],y:point[1]},
                    validPos = scope.model.isValidPos(pos);
                ghostNode
                    .attr({
                        transform : 'translate(' + point + ')'
                    })
                    .select('.center').style('fill', function() {return validPos?'green':'red'})

                // Update ghost links
                var connectedNodes = scope.model.getConnectedNodes(pos);
                var ghostLinks = linkLayer.selectAll('.ghost-link').data(connectedNodes);
                ghostLinks.enter().append('line')
                    .attr({
                        class : 'ghost-link'
                    });
                ghostLinks.attr({
                        x1 : point[0],
                        y1 : point[1],
                        x2 : function(d) {return d.pos.x},
                        y2 : function(d) {return d.pos.y},
                    })
                    .style('visibility', validPos?'visible':'hidden');
                ghostLinks.exit().remove();
            })

            world.on('mouseleave', function() {
                    ghostNode.style('visibility', 'hidden');
                    linkLayer.selectAll('.ghost-link').style('visibility', 'hidden');
                })
                .on('mouseenter', function() {
                    ghostNode.style('visibility', 'visible')
                })

            /*
             * RENDERING
             */

            scope.render = function() {
                var gnodes = nodeLayer.selectAll('.g-node').data(scope.nodes, function(d) {return d.id})
                
                gnodes.enter()
                    .append('g')
                        .attr('class', 'g-node')
                        .attr('transform', function(d) {return 'translate('+[d.pos.x, d.pos.y]+')'})
                        .append('g')
                            .attr('class', 'node')
                        .each(function(d) {
                            var container = d3.select(this);
                            var interactiveElem = d.svgViewEnter(container)
                            interactiveElem
                                .attr('transform', 'scale(0)')
                                .on('mouseover', function() {
                                    scope.onhoverNode({node:d});
                                })
                                .on('click', function() {
                                    scope.onclickNode({node:d});
                                })
                                .on('mouseenter', function() {
                                    container.classed('hovered', true);
                                    /* enter animation */
                                    d3.select(this)
                                        .transition().duration(500).ease('elastic').attr('transform', 'scale(1.2)')
                                })
                                .on('mouseleave', function() {
                                    container.classed('hovered', false);
                                    /* leave animation */
                                    d3.select(this)
                                        .transition().duration(500).ease('elastic').attr('transform', 'scale(1)')

                                })
                                .transition().duration(750).ease('elastic').attr('transform', 'scale(1)')
                        })
                        

                gnodes.select('.node').each(function(d) {
                    d.svgViewUpdate(d3.select(this));
                })

                gnodes.exit().remove();

                /* Node links */
                var glinks = linkLayer.selectAll('.links-group').data(scope.nodes.filter(function(d) {return d.neighbors}), function(d) {return d.id});
                glinks.enter().append('g').attr('class', 'links-group')
                glinks.each(function(node) {
                    var links = d3.select(this).selectAll('.link').data(node.neighbors, function(d) {return d.id});
                    links.enter()
                        .append('line')
                            .attr({
                                class : 'link',
                                x1 : node.pos.x,
                                y1 : node.pos.y,
                                x2 : function(d) {return d.pos.x},
                                y2 : function(d) {return d.pos.y},
                            })
                    links.exit().remove();
                })
                glinks.exit().remove();

                /* House links */
                var houselinks = linkLayer.selectAll('.houselinks-group').data(scope.nodes.filter(function(d) {return d.houses}), function(d) {return d.id});
                houselinks.enter().append('g').attr('class', 'houselinks-group')
                houselinks.each(function(node) {
                    var houselinks = d3.select(this).selectAll('.link').data(node.houses)
                    houselinks.enter()
                            .append('line')
                            .attr({
                                class : 'link',
                                x1 : function(d) {return d.nearestPos.x},
                                y1 : function(d) {return d.nearestPos.y},
                                x2 : function(d) {return d.pos.x},
                                y2 : function(d) {return d.pos.y},
                            })
                    houselinks.exit().remove();
                })

            }

            /*
                Display all routes (i.e links between markets)
                => not a good idea : some routes overlap, what about the back loop (link between last market and first market),...
                => better to do : road and transport feature
            */
            function renderRoutes() {
                var routes = linkLayer.selectAll('.route-group').data(scope.routes);
                routes.enter().append('g')
                    .attr('class', 'route-group');
                routes.exit().remove();

                var steps = routes.selectAll('.step').data(function(d) {return d.steps})

                routes.each(function(d) {
                    var steps = d.steps.filter(function(e) {return e.market});
                    var links = d3.select(this).selectAll('.routelink').data(steps);
                    links.enter()
                            .append('line')
                                .attr('class', 'routelink')
                    links.attr({
                        x1 : function(d) {return d.market.pos.x},
                        y1 : function(d) {return d.market.pos.y},
                        x2 : function(d,i) {var next = steps[i+1] || d; return next.market.pos.x},
                        y2 : function(d,i) {var next = steps[i+1] || d; return next.market.pos.y},
                    })
                })
            }

            function renderRoute(route) {
                if (!route) {
                    routeLayer.selectAll('*').remove();
                    return;
                }
                var stepsData = route.steps.filter(function(e) {return e.market});
                var steps = routeLayer.selectAll('.step').data(stepsData);
                var newSteps = steps.enter().append('g')
                    .attr('class', 'step');
                newSteps.append('line')
                    .attr('class', 'step-link')
                newSteps.append('circle')
                    .attr('class', 'highlight')
                newSteps.append('text')
                    .attr('class', 'label')


                steps.select('.highlight')
                    .attr({
                        cx : function(d) {return d.market.pos.x},
                        cy : function(d) {return d.market.pos.y},
                        r : function(d) {return d.market.size / 2}
                    })
                steps.select('.label')
                    .text(function(d,i) {return i+1})
                    .attr({
                        x : function(d) {return d.market.pos.x},
                        y : function(d) {return d.market.pos.y},
                        dy : '.3em',
                    });
                steps.select('.step-link')
                    .attr({
                        x1 : function(d) {return d.market.pos.x},
                        y1 : function(d) {return d.market.pos.y},
                        x2 : function(d,i) {var next = stepsData[i+1] || d; return next.market.pos.x},
                        y2 : function(d,i) {var next = stepsData[i+1] || d; return next.market.pos.y},
                    })

                steps.exit().remove();
            }

            function renderLinks() {
                var links = linkLayer.selectAll('.market-link').data(scope.links.list);
                links.enter().append('line')
                    .attr('class', 'market-link');

                links.attr({
                        x1 : function(d) {return d.market1.pos.x},
                        y1 : function(d) {return d.market1.pos.y},
                        x2 : function(d) {return d.market2.pos.x},
                        y2 : function(d) {return d.market2.pos.y},
                    })
                    .style({
                        'stroke-width' : function(d) {return 3 + d.count}
                    })

                links.exit().remove();

            }

            function renderAgents() {
                var agents = agentLayer.selectAll('.agent').data(scope.agents)
                var newAgents = agents.enter()
                        .append('g')
                            .attr('class', 'agent');
                newAgents.append('rect')
                    .attr({
                        x : -5,
                        y : 0,
                        rx:2,
                        ry:2,
                        width : 10,
                        height : 30
                    })
                /*newAgents.append('g').attr('transform', 'translate(-20,0)rotate(90)')
                    .append('text')
                        .text(function(d) {return d.name})*/

                agents.transition()
                    .duration(function(d){return d.travelCounter?scope.conf.gameSpeed:0})
                    .ease('linear')
                    .attr('transform', function(d) {
                        return (d.pos ? 'translate(' + [d.pos.x, d.pos.y] + ')' : '')
                               + (d.angle? 'rotate('+ d.angle +')' : '')
                               + 'translate(0,-15)'
                    })

                agents.style('display', function(d) {return d.route?'inline':'none'})

                agents.style('visibility', function(d) {return d.state=='atMarket'?'hidden':'visible'})

                agents.each(function(agent) {
                    var resources = d3.select(this).selectAll('.resource').data(agent.resources);
                    resources.enter().append('rect')
                        .attr({
                            'class' : 'resource',
                            x : -5,
                            width : 10,
                            height : 10,
                        });
                    resources
                        .attr({
                            y : function(d,i) {return 10*i},
                        })
                        .style('fill', function(d) {return d.color})
                    resources.exit().remove()
                })

                agents.exit().remove();
            }

        } // /link
    };
}])

;
