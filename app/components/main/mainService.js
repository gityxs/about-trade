/*
    Game design (reminder)
    - init : resources and quantity on the map
    - resources base price and production time
    - population needs (resource and weight)

    - market area radius
    - route slot numbers
    - trader speed

    - market build cost
    - trader hire cost

    # system
    - market item price evolution and min,max
    - population demand evolution
    - population satisfaction and migration

*/
angular.module('myApp')

.factory('playerService', function() {
    var player = {

    }

    player.money = 1000;

    player.setMoney = function(amount) {
        player.money = amount;
    }
    player.earn = function(amount) {
        player.money += amount;
    }
    player.lose = function(amount) {
        player.money -= amount;
    }

    return player;
})
.factory('traderService', function(playerService) {
    var self = {};

    self.traders = [
    ]
    self.info = {
        baseCost : 150,
        costFactor : 50,
    };
    self.info.cost = self.info.baseCost;

    class Trader {
        constructor(name) {
            this.name = name;
            this.route = undefined;
            this.stepIdx = 0;
            this.state = undefined; // onRoad || atMarket || waiting (i.e wait for a market to be associated with the current step)
            this.resources = [];
            this.orders = {
                'sell' : [],
                'buy' : []
            };
            this.pos = undefined;
            this.direction = undefined;
            this.angle = 0;
            this.speed = 30;
            this.currentMarket = undefined;
            this.travelCounter = 0;
            this.balance = 0;

            // List of market orders
            this.pendingOrders = [];
        }
        routeChanged() {
            if (!this.pos) { // First route assignment
                this.currentMarket = this.route.steps[this.stepIdx].market;
                if (!this.currentMarket) {
                    this.state = "waiting";
                } else {
                    this.enterMarket(this.currentMarket)
                }
            } else { // route changed
                this.stepIdx = -1;
                if (this.state == "onRoad" || this.state == "waiting") {
                    this.nextStep();
                }
            }
        }
        nextStep() {
            this.stepIdx++;
            this.stepIdx %= this.route.steps.length;
            this.currentMarket = this.route.steps[this.stepIdx].market;
            if (!this.currentMarket) {
                this.state = "waiting";
            } else {
                this.goToMarket(this.currentMarket);
            }
        }
        leaveMarket(market) {
            this.currentMarket.leave(this.name, this.orders);
            this.nextStep();
        }
        cancelCurrentOrders() {
            this.currentMarket.cancelOrders(this.pendingOrders);
            this.pendingOrders.splice(0, this.pendingOrders.length);
            this.orders['sell'].splice(0, this.orders['sell'].length);
            this.orders['buy'].splice(0, this.orders['buy'].length);
        }
        clearAll() {
            // Cancel current market orders
            this.cancelCurrentOrders();
            // Throw all carried resources away
            this.resources.splice(0,this.resources.length);
            // Leave market
            this.leaveMarket();
        }
        resolveOrder(resource, type, order) {
            // update internal orders
            var idx = this.orders[type].findIndex(function(e) {return e==resource});
            this.orders[type].splice(idx, 1);

            // update market orders list
            idx = this.pendingOrders.findIndex(function(e) {return e==order});
            this.pendingOrders.splice(idx, 1);

            if (!this.orders['sell'].length && !this.orders['buy'].length) {
                this.leaveMarket();
            }
        }
        onSell(resource, price, order) {
            this.resolveOrder(resource, 'sell', order);
            var idx = this.resources.findIndex(function(e) {return e==resource});
            this.resources.splice(idx,1);
            playerService.earn(price);
            this.balance += price;
        }
        onBuy(resource, price, order) {
            this.resolveOrder(resource, 'buy', order);
            this.resources.push(resource);
            playerService.lose(price);
            this.balance -= price;
        }
        goToMarket(market) {
            this.state = 'onRoad';
            this.direction = normVector(this.pos, this.currentMarket.pos);
            this.angle = 90 + Math.atan2(this.direction[1], this.direction[0])*180/Math.PI;
        }
        enterMarket(market) {
            this.state = 'atMarket';

            this.pos = angular.copy(market.pos);
            market.enter(this.name, this.orders, {clearAll: this.clearAll.bind(this)});
            this.currentMarket = market;

            // Build orders list according to carried resource and current step slots
            // Browse all carried resources, if wanted then flag slot else sell resource
            var targetSlots = this.route.steps[this.stepIdx].slots;
            for (var r in this.resources) {
                var resource = this.resources[r];
                var slot = targetSlots.find(function(e) {return (e.resource == resource) && !e.flag})
                if (slot) {
                    slot.flag = true;
                } else {
                    this.orders.sell.push(resource);
                    //market.supply(resource, onSell);
                }
            }
            // Browse all current step slots, if not flagged then sell slot resource.
            for (var s in targetSlots) {
                var slot = targetSlots[s];
                if (!slot.flag && slot.resource) {
                    this.orders.buy.push(slot.resource);
                    //market.demand(slot.resource, onBuy);
                }
                delete slot.flag;
            }
            // Put orders on market
            // clone orders arrays before loop because while putting order on market the orders can be resolved and so original array modified
            var buyOrders = this.orders.buy.slice(0),
                sellOrders = this.orders.sell.slice(0)
            for (var o in buyOrders) {
                var orderPointer = market.demand(buyOrders[o], this.onBuy.bind(this));
                orderPointer && this.pendingOrders.push(orderPointer);
            }
            for (var o in sellOrders) {
                var orderPointer = market.supply(sellOrders[o], this.onSell.bind(this));
                orderPointer && this.pendingOrders.push(orderPointer);
            }

            if (!buyOrders.length && !sellOrders.length) {
                this.leaveMarket();
            }
        }
        update() {
            if (!this.route || (this.state == 'atMarket')) {
                return;
            }
            if (this.state == 'waiting') {
                this.currentMarket = this.route.steps[this.stepIdx] && this.route.steps[this.stepIdx].market;
                if (this.currentMarket) {
                    if (!this.pos) {
                        this.enterMarket(this.currentMarket);
                    } else {
                        this.goToMarket(this.currentMarket);
                    }
                }
            } else {
                if (distance(this.pos, this.currentMarket.pos) <= this.speed) {
                    this.enterMarket(this.currentMarket);
                } else {
                    this.pos.x += this.direction[0] * this.speed;
                    this.pos.y += this.direction[1] * this.speed;
                    this.travelCounter++;
                }
            }
        }
    }

    self.newTrader = function() {
        var trader = new Trader('trader ' + (self.traders.length+1));
        self.traders.push(trader);

        playerService.lose(self.info.cost);
        self.info.cost += self.info.costFactor;

        return trader;
    }

    self.canHire = function() {
        return self.info.cost <= playerService.money;
    }

    function normVector(a,b) {
        var distAB = distance(a,b);
        return [ (b.x-a.x)/distAB, (b.y-a.y)/distAB ];
    }
    function distance(a,b) {
        return Math.sqrt( Math.pow(a.x-b.x, 2) + Math.pow(a.y-b.y, 2) )
    }


    self.update = function() {
        for (var t in self.traders) {
            var trader = self.traders[t];
            trader.update();
        }
    }

    self.clear = function() {
        self.info.cost = self.info.baseCost;
        self.traders.splice(0, self.traders.length);
    }

    return self;
})

.factory('routeService', function() {
    var self = {};

    self.routes = [
    ]

    self.marketLinks = {
        updatetime : 0,
        list : [
        ]
    };

    /* Reduild the market-market links list corresponding to all routes */
    self.updateLinks = function() {
        self.marketLinks.list = [];
        self.routes.forEach(function(route) {
            for (var s = 0; s < route.steps.length; s++) {
                var step = route.steps[s],
                    nextStep = route.steps[s+1];
                if (step.market && nextStep && nextStep.market) {
                    var matchinglink = self.marketLinks.list.find(function(link) {
                        return ((link.market1==step.market) && (link.market2==nextStep.market)) ||
                               ((link.market1==nextStep.market) && (link.market2==step.market))
                    })
                    if (matchinglink) {
                        matchinglink.count++;
                    } else {
                        self.marketLinks.list.push({
                            market1 : step.market,
                            market2 : nextStep.market,
                            count : 1
                        })
                    }
                }
            }
        })
        self.marketLinks.updatetime = Date.now();
    }

    self.newRoute = function() {
        var route = {
            name : 'route ' + (self.routes.length+1),
            steps : []
        };
        //self.addRouteStep(route);
        self.routes.push(route);
        return route;
    }

    self.addRouteStep = function(route) {
        var step = {
            market : undefined,
            slots : [{},{},{}]
        };
        route.steps.push(step);
        return step;
    }

    self.clear = function() {
        self.routes.splice(0, self.routes.length);
    }

/*    self.onNodeSelected = function(node) {
        if (node.constructor.name == 'Market') {
            console.log("MAZRKET SELECTED")
        }
    }*/

    return self;
})

.factory('stateService', function() {
    var self = {};

    self.selectedNode = null/*{
        'Market' : null
    }*/;
    self.selectedRoute = null;//{updatetime:0};
    self.selectedMenu = null;

    self.onNodeSelected = function(node) {
        self.selectedNode = node;
        //self.selectedNode[node.constructor.name] = node;
    }

    self.onRouteSelected = function(route) {
        self.selectedRoute = route;
    }

    return self;
})

.factory('mainService', function($http, playerService) {
    var main = {};

    main.nodes = [];
    main.lastNodeID = 0;
    main.conf = {
        mapSize : 1000
    }
    main.nodeModels = {
        'markets' : [],
        'workshops' : [],
        'buildings' : []
    };
    main.populationNeeds = [];
    var resources;
    var initData, marketsData, buildingsData, workshopsData, advancesConf;

    $http.get('app/data/conf.json')
       .then(function(res){
            loadConf(res.data);
            init();
        }, function(err) {
            console.log('Error loading conf file');
            console.log(err);
        });

    function loadConf(conf) {
        initData = conf.general;
        main.conf.mapSize = conf.general.mapSize;
        handleResources(conf.resources);
        marketsData = [{name:'market', price:'150'}];
        buildingsData = conf.buildings;
        workshopsData = conf.workshops;
        advancesConf = conf.advances;
    }

    function handleResources(resourcesList) {
        /*
            colors : see http://www.flatuicolorpicker.com/
            Complex resources must be placed after their needed resources (=> see basePrice computation)
        */
        resources = resourcesList;
        //  - Create the link between needed resources and actual resources
        //      i.e add a pointer to the resource according to provided resource name
        //  - Compute base price = sum base price of needed resources + production cost
        for (var r in resources) {
            var resource = resources[r];
            var basePrice = resource.basePrice || resource.productionCost;
            for (var n in resource.neededResources) {
                var need = resource.neededResources[n];
                need.resource = getResource(need.name);
                basePrice += need.resource.basePrice * need.quantity;
            }
            resource.basePrice = basePrice;
        }
    }

    function getResource(name) {
        return resources.find(function(e) {return e.name == name});
    }


    class NodeModel {
        constructor(node, price) {
            this.node = node;
            this.price = price;
        }
        isDisabled() {
            return this.price > playerService.money;
        }
        isValidPos(pos) {
            return !collide(pos,this.node.size);
        }
        getConnectedNodes(pos) {
            var nearNode = getAreaNearNode(pos);
            return nearNode?[nearNode]:[];
        }
        onAdded(node) {
            // Tell nearest node that it has a new neighbor
            var nearNode = getAreaNearNode(node.pos);
            if (nearNode) {
                nearNode.addNeighbor(node);
            }
        }
        // Helper method to replace copied resources to actual resources pointer
        // Explanation : linked resources are copied during model copy to create the new node (maybe this proces is bad...)
        // Later we reference and manipulate resource using its pointer so we want a common pointer for resource
        _linkResources(list) {
            for (var i in list) {
                var elem = list[i];
                elem.resource = getResource(elem.resource.name);
            }
        }
    }

    class MarketModel extends NodeModel {
        isValidPos(pos) {
            return !areaCollide(pos,this.node.areaRadius) && !collide(pos,this.node.size);
        }
        getConnectedNodes(pos) {
            return getNodesInArea(pos,this.node.areaRadius);
        }
        onAdded(node) {
            var connectedNodes = getNodesInArea(node.pos,node.areaRadius);
            node.setNeighbors(connectedNodes);
            node.setPopulationNeeds(main.populationNeeds);
        }
    }

    class ExploitationModel extends NodeModel {
        onAdded(node) {
            super._linkResources([node]);
            super.onAdded(node);
        }
    }

    class WorkshopModel extends NodeModel {
        onAdded(node) {
            super._linkResources(node.products);
            super.onAdded(node);
        }
    }

    class BuildingModel extends NodeModel {
        onAdded(node) {
            super._linkResources(node.needs);
            super.onAdded(node);
        }
    }

    main.initNodeModels = function() {
        // Clear all model types
        ['markets', 'workshops', 'buildings'].forEach(function(type) {
            main.nodeModels[type].splice(0, main.nodeModels[type].length);
        })

        // Initial market model
        main.nodeModels['markets'].push(new MarketModel(new Market(), marketsData[0].price));
    }

    function addWorkshopModel(node, price) {
        var wmodel = new WorkshopModel(node, price);
        main.nodeModels['workshops'].push(wmodel);
        return wmodel;
    }

    function _getWorkshopModel(name) {
        return main.nodeModels['workshops'].find(function(m) {return m.node.name == name});
    }


    function addBuildingModel(node, price) {
        var bmodel = new BuildingModel(node, price);
        main.nodeModels['buildings'].push(bmodel);
        return bmodel;
    }


    function _newBuildingModel(buildingName) {
        var buildingData = buildingsData.find(function(d) {return d.name == buildingName});
        buildingData = buildingData || {
            price : 0
        }
        // Build the needs list adding actual resource pointer
        var needs = [];
        for (var n in buildingData.needs) {
            var need = buildingData.needs[n];
            var r = getResource(need.name)
            needs.push({
                resource : r,
                weight : need.weight
            })
        }

        var building = new Building(buildingData.symbol, needs);
        return addBuildingModel(building, buildingData.price);
    }

    function _newWorkshopModel(workshopName) {
        var workshopData = workshopsData.find(function(d) {return d.name == workshopName});
        workshopData = workshopData || {
            price : 0
        }
        var workshop = new Workshop(workshopName);
        return addWorkshopModel(workshop, workshopData.price);
    }

    function _addNode(model, pos, owner) {
        var newNode = angular.copy(model.node);
        newNode.pos = pos;
        newNode.owner = owner;
        newNode.id = ++main.lastNodeID;
        model.onAdded(newNode);
        main.nodes.push(newNode);
        return newNode;
    }

    main.addNode = function(model, pos) {
        playerService.lose(model.price);
        return _addNode(model, pos, playerService);
    }

    main.removeNode = function(node) {
        var idx = main.nodes.findIndex(function(e) {return e==node});
        console.log(idx);
        if (idx >= 0) {
            main.nodes.splice(idx,1);
            // Inform other nodes that potential neighbor was removed
            main.nodes.forEach(function(n) {
                n.removeNeighbor && n.removeNeighbor(node)
            })
        }
    }

    /* UTILS */

    function randPick(a) {
        return a[Math.floor(Math.random()*a.length)];
    }

    function distance(p1, p2) {
        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2))
    }

    function areaCollide(pos, radius) {
        for (var n in main.nodes) {
            var node = main.nodes[n];
            if (node.areaRadius && distance(node.pos, pos) < node.areaRadius+radius) {
                return true;
            }
        }
        return false;
    }

    /* Check if (pos,size) collide with one of nodes */
    function collide(pos, size, nodes) {
        nodes = nodes || main.nodes;
        for (var n in nodes) {
            var node = nodes[n];
            if (distance(node.pos, pos) < node.size+size) {
                return true;
            }
        }
        return false;
    }

    function getNodesInArea(pos,radius) {
        var nodes = [];
        for (var n in main.nodes) {
            var node = main.nodes[n];
            if (distance(node.pos, pos) < radius) {
                nodes.push(node);
            }
        }
        return nodes;
    }

    function getAreaNearNode(pos) {
        var areaNode = undefined;
        for (var n in main.nodes) {
            var node = main.nodes[n];
            if (node.areaRadius && (distance(node.pos, pos) < node.areaRadius)) {
                areaNode = node;
            }
        }
        return areaNode;
    }

    function _addNodeAtRandomPosition(model) {
        var pos;
        var margin = 5;
        var size = model.node.size + margin;
        var mapSize = main.conf.mapSize - size;

        do {
            var r = Math.random()*Math.pow(mapSize/2,2),
                a = Math.random()*2*Math.PI;
            pos = {
                    x: Math.sqrt(r) * Math.cos(a),
                    y: Math.sqrt(r) * Math.sin(a),
                }
            /*pos = {
                    x: size/2 + Math.random()*(mapSize) - mapSize/2,
                    y: size/2 + Math.random()*(mapSize) - mapSize/2,
                }*/
        //} while (collide(pos, size));
        } while (!model.isValidPos(pos));

        _addNode(model, pos);
    }

    function _addNodesAtRandomPosition(model, count) {
        if (!count) {return}
        for (var i = count; i>0; i--) {
            _addNodeAtRandomPosition(model);
        }

    }

    main.newGame = function() {
        init();
    }

    function init() {
        playerService.setMoney(initData.playerMoney);
        main.nodes.splice(0, main.nodes.length);
        main.lastNodeID = 0;
        main.populationNeeds.splice(0, main.populationNeeds.length);
        main.initNodeModels();
        main.manageAdvances(0);
    }

    main.manageAdvances = function(turn) {
        var advances = advancesConf[turn];

        for (var a in advances) {
            var advance = advances[a];
            if (advance.resourceName) {
                var resource = getResource(advance.resourceName);
                advance.resource = resource;

                /* Resource site */
                if (advance.exploitationNumber) {
                    advance.exploitation = new Exploitation(null, resource);
                    var emodel = new ExploitationModel(advance.exploitation);
                    _addNodesAtRandomPosition(emodel, advance.exploitationNumber);
                }

                /* Workshop */
                if (resource.workshop) {
                    // Create or update model
                    var wmodel = _getWorkshopModel(resource.workshop);
                    if (!wmodel) {
                        wmodel = _newWorkshopModel(resource.workshop);
                    } else {
                        advance.oldworkshop = angular.copy(wmodel.node);
                    }
                    wmodel.node.addProduction(resource);
                    advance.workshop = wmodel.node;

                    // Update existing workshop
                    for (var n in main.nodes) {
                        var node = main.nodes[n];
                        //if (node instanceof Workshop) {
                        if (node.name == resource.workshop) {
                            node.addProduction(resource);
                        }
                    }

                    // Add workshop on map
                    _addNodesAtRandomPosition(wmodel, advance.workshopNumber);
                }

                /* Population needs */
                if (advance.populationNeedWeight) {
                    main.populationNeeds.push({
                        resource : resource,
                        weight : advance.populationNeedWeight
                    })
                }
            }

            /* Advance : New building */
            if (advance.buildingName) {
                // Create new building model
                var bmodel = _newBuildingModel(advance.buildingName);
                advance.building = bmodel.node;
                // Add building on map
                _addNodesAtRandomPosition(bmodel, advance.buildingNumber);
            }
        }
        return advances;
    }

    main.update = function () {
        /* Update nodes 
            entry update nodes are Markets
            it's up to market to update its connected nodes
            nodes not connected to a market are not updated
        */
        for (var n in main.nodes) {
            var node = main.nodes[n];
            if (node instanceof Market) {
                node.update();
            }
        }
    }

    //init();

    return main;
})
;