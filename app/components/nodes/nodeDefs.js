class Node {
    constructor(pos,color,size) {
        this.name = 'node name';
        this.pos = pos;
        this.color = color;
        this.size = size;
        this.connected = false;
        this.updatetime = 0;
    }
    isActive() {
        return this.connected;
    }
    update(market) {
    }
    getSuppliedResources() {
        return [];
    }
    getDemandedResources() {
        return [];
    }
    deconnect(market) {
    }
}

class Producer extends Node {
    constructor(pos, resource) {
        super(pos,resource && resource.color,10);
        this.resource = resource;
        this.productionProgress = 0;
        this.stopped = false;
    }

    isStopped() {
        return this.connected && this.stopped;
    }
}
class Exploitation extends Producer {
    constructor(pos, resource) {
        super(pos,resource);
    }

    update(market) {
        if (market.getItem(this.resource).sellerQueue.length >= 20) {
        //if (market.getItem(this.resource).pricePercentVariation <= -50) {
        //if (market.getItem(this.resource).pricePercentVariation <= -40) {
            // price is too low (base price - 50%) => stop production
            this.productionProgress = 0;
            this.stopped = true;
        } else {
            this.stopped = false;
            if (this.productionProgress >= this.resource.productionTime) {
                this.productionProgress = 0;
                market.supply(this.resource)
            } else {
                this.productionProgress++;
            }
        }
    }

    getSuppliedResources() {
        return [this.resource];
    }
}

class Workshop extends Producer {
    constructor(name) {
        //super(undefined,resource);
        super();
        this.name = name;
        this.size = 15;

        this.producing = false;
        this.stopped = true;
        this.profitable = true;

        this.products = [];
        this.currentProduct = null;

        this.balance = 0;

        this.pendingOrders = [];

        this.stock = {};
    }

    allowControl() {
        return this.owner;
    }
    onModeChanged() {
        if (this.currentProduct) {
            if (this.currentProduct.mode == 'off' && !this.producing) {
                // Cancel current product. Corresponding orders will be canceled at the next update
                this.currentProduct = null;
            }
        }
    }
    addProduction(resource) {
        var stock = {};
        for (var n in resource.neededResources) {
            var need = resource.neededResources[n];
            this.stock[need.resource.name] = this.stock[need.resource.name] || 0;
        }
        this.products.push({
            resource : resource,
            mode : 'auto',
            //stock : stock,
            productionProgress : 0
        });

        // Inform watchers
        this.updatetime = Date.now();
    }
    getSuppliedResources() {
        return this.products.map(function (p) {return p.resource});
    }
    getDemandedResources() {
        var needed = [];
        for (var i in this.products) {
            needed = needed.concat(this.products[i].resource.neededResources)
        }
        return needed.map(function (n) {return n.resource});
    }
    onBuy(resource, price, order) {
        var product = this.currentProduct;

        //product.stock[resource.name].current++;
        this.stock[resource.name]++;

        // Remove oder from list
        var idx = this.pendingOrders.findIndex(function(e) {return e==order});
        this.pendingOrders.splice(idx, 1);

        // Check if all resources are provided
        var ok = true;
/*        for (var s in product.stock) {
            ok = ok && (product.stock[s].current == product.stock[s].needed);
        }*/
        for (var n in product.resource.neededResources) {
            var need = product.resource.neededResources[n];
            ok = ok && (this.stock[need.resource.name] >= need.quantity);
        }
        if (ok) {
            this.producing = true;
        }

        if (this.owner) {
            this.owner.lose(price);
            this.balance -= price;
        }
    }
    onSell(resource, price) {
        if (this.owner) {
            this.owner.earn(price);
            this.balance += price;
        }
    }
    putOrders(market) {
        var product = this.currentProduct;
        for (var n in product.resource.neededResources) {
            var need = product.resource.neededResources[n];
            //product.stock[need.resource.name].current = 0;

            var neededQuantity = need.quantity-this.stock[need.resource.name];
            for (var i = 0; i < neededQuantity; i++) {
                var orderPointer = market.demand(need.resource, this.onBuy.bind(this));
                orderPointer && this.pendingOrders.push(orderPointer);
            }
        }
    }
    consumeStock() {
/*        for (var s in this.currentProduct.stock) {
           this.currentProduct.stock[s].current = 0;
        }*/
        var usedResources = this.currentProduct.resource.neededResources;
        for (var n in usedResources) {
            var need = usedResources[n];
            this.stock[need.resource.name]-= need.quantity;
        }
    }
    cancelCurrentProduction(market) {
        market.cancelOrders(this.pendingOrders);
        this.pendingOrders.splice(0, this.pendingOrders.length);
    }
    computeProfitability(market, product) {
        var totalCost = product.resource.productionCost;
        for (var n in product.resource.neededResources) {
            var need = product.resource.neededResources[n];
            totalCost += need.quantity * market.getItem(need.resource).currentPrice;
        }
        return market.getItem(product.resource).currentPrice - totalCost;
    }
    startProcess(market) {
        // Find the most profitable product
        var maxProfitabily, betterProduct = null;
        for (var p in this.products) {
            var product = this.products[p];
            if (product.mode != 'off') {
                var profitability = this.computeProfitability(market, product);
                if (product.mode == 'on' || profitability >= 0) {
                    if (!betterProduct || (profitability > maxProfitabily)) {
                        maxProfitabily = profitability;
                        betterProduct = product;
                    }
                }
            }
        }

        // Start process for the better product
        this.currentProduct = betterProduct;
        this.profitable = (this.currentProduct != null);//this.isProfitable(market);
        if (this.profitable) {
            this.putOrders(market);
            this.stopped = false;
        } else {
            this.stopped = true;
        }
    }
    update(market) {
        var product = this.currentProduct;
        if (this.producing) {
            if (product.productionProgress >= product.resource.productionTime) {
                product.productionProgress = 0;
                market.supply(product.resource, this.onSell.bind(this));
                this.consumeStock();
                this.producing = false;
                this.startProcess(market);
            } else {
                product.productionProgress++;
            }
        } else if (!this.currentProduct) {
            this.cancelCurrentProduction(market);
            this.startProcess(market);
        }
    }
    deconnect(market) {
        this.cancelCurrentProduction(market);
    }
}

class Building extends Node {
    constructor(symbol, needs) {
        super(null, 'white', 15);
        this.symbol = symbol;
        this.needs = needs;
    }
    getDemandedResources() {
        return this.needs.map(function (n) {return n.resource});
    }
    update(market) {
        for (var n in this.needs) {
            var need = this.needs[n];
            if (market.getItem(need.resource).buyerQueue.length < 20) {
                market.raiseNeed(need.resource, need.weight);
            }
        }
    }
}

class Market extends Node {
    constructor(pos) {
        super();
        this.name = 'market';
        this.color = 'red';
        this.size = 20;
        this.areaRadius = 60;
        this.neighbors = [];
        this.itemList = [];
        this.traders = [];
        this.population = 0;
        this.houses = [];
        this.populationNeeds = undefined;
        this.satisfaction = 0;
        this.satisfactionCounter = 0;

        /*for (var i=0; i<this.population; i++) {
            this.addHouse();
        }*/
    }
    setNeighbors(neighbors) {
        // Add and init market item supplied by neighbors
        for (var n in neighbors) {
            this.addNeighbor(neighbors[n]);
        }
    }
    addNeighbor(node) {
        node.connected = true;
        this.neighbors.push(node);
        this._setLocalSupplyAndDemand(node);
    }
    removeNeighbor(node) {
        var idx = this.neighbors.findIndex(function(e) {return e==node});
        if (idx >= 0) {
            this.neighbors.splice(idx, 1);
            node.deconnect(this);

            // Reset local supply/demand
            this.itemList.forEach(function(item) {
                item.localsupply = false;
                item.localdemand = false;
            })
            // Pop demand
            var self = this;
            this.populationNeeds.forEach(function(need) {
                var item = self._marketItem(need.resource);
                item.localdemand = true;
            })
            // Neighbors supply/demand
            this.neighbors.forEach(function(neighbor) {
                self._setLocalSupplyAndDemand(neighbor);
            })
        }
    }
    /*neighborChanged(node) {
        this._setLocalSupplyAndDemand(node);
    }*/
    setPopulationNeeds(needs) {
        this.populationNeeds = needs;
    }
    enter(name, orders, actions) {
        this.traders.push({name:name,orders:orders, actions:actions});
    }
    leave(name, orders) {
        var idx = this.traders.findIndex(function(e) {return e.orders == orders});
        this.traders.splice(idx,1);
    }
    getItem(resource) {
        return this.itemList.find(function(e) {return e.resource == resource});
    }
    _setLocalSupplyAndDemand(node) {
        var suppliedResources = node.getSuppliedResources();
        for (var r in suppliedResources) {
            var resource = suppliedResources[r];
            var item = this._marketItem(resource);
            item.localsupply = true;
        }
        var demandedResources = node.getDemandedResources();
        for (var r in demandedResources) {
            var resource = demandedResources[r];
            var item = this._marketItem(resource);
            item.localdemand = true;
        }
    }
    _marketItem(resource) {
        var item = this.getItem(resource);
        if (!item) {
            item = {
                resource:resource,
                currentPrice:resource.basePrice,
                pricePercentVariation:0,
                sellerQueue : [],
                buyerQueue : [],
                needCounter : 0,
            };
            this.itemList.push(item);
        }
        return item;
    }
    _resolve(item, bOrder, sOrder) {
        bOrder.cb && bOrder.cb(item.resource, item.currentPrice, bOrder);
        sOrder.cb && sOrder.cb(item.resource, item.currentPrice, sOrder);
    }
    supply(resource, callback) {
        var orderData;
        var item = this._marketItem(resource);
        if (item.buyerQueue.length) {
            var buyerOrder = item.buyerQueue.shift();
            this._resolve(item, buyerOrder, {cb:callback});
        } else {
            orderData = {cb:callback};
            item.sellerQueue.push(orderData);
        }
        return orderData;
    }
    demand(resource, callback, popFlag) {
        var orderData;
        var item = this._marketItem(resource);
        if (item.sellerQueue.length) {
            var sellerOrder = item.sellerQueue.shift();
            this._resolve(item, {cb:callback}, sellerOrder);
        } else {
            var orderData = {cb:callback};
            popFlag && (orderData.fromPop=1);
            item.buyerQueue.push(orderData);
        }
        return orderData;
    }
    cancelOrders(orders) {
        var allItems = this.itemList;
        // For each orders to cancel we look for it in sellers and buyers queue of each item
        orders.forEach(function(order) {
            allItems.forEach(function(item) {
                var idx = item.sellerQueue.findIndex(function(e) {return e == order});
                if (idx>=0) {
                    item.sellerQueue.splice(idx, 1);
                } else {
                    idx = item.buyerQueue.findIndex(function(e) {return e == order});
                    if (idx>=0) {
                        item.buyerQueue.splice(idx, 1);
                    }
                }
            })
        })
    }
    raiseNeed(resource, value, callback) {
        var item = this._marketItem(resource);
        item.needCounter += value;
        if (item.needCounter >= 100) {
            this.demand(resource, callback);
            item.needCounter -= 100;
        }
    }
    addHouse() {
        var pos;
        var size = 5;
        var margin = 5;
        var counter = 0;
        var dist = 0;

        // Find a valid position in market area
        do {
            pos = {
                    x: this.pos.x + Math.random()*this.areaRadius*2 - this.areaRadius,
                    y: this.pos.y + Math.random()*this.areaRadius*2 - this.areaRadius,
                }
            dist = ggUtils.distance(pos, this.pos);
        } while (
            dist >= this.areaRadius ||                                       // out of market area
            dist <= this.size + size + margin ||                             // collide with market
            ggUtils.collide(pos, size+margin, this.neighbors) ||             // collide with neighbors
            (++counter<200 && ggUtils.collide(pos, size+1, this.houses))     // collide with other houses (this constraint is relaxed after some attempts)
        );
        var nearest = this;

        // Find the nearest node to connect with
        //if (dist > this.size + 20) {
            var minDist = dist;
            var nearNodes = this.neighbors.concat(this.houses);
            for (var n in nearNodes) {
                var node = nearNodes[n];
                var dist = ggUtils.distance(pos, node.pos);
                if (dist < minDist) {
                    minDist = dist;
                    nearest = node;
                }
            }
        //}

        this.houses.push({pos:pos,size:size,nearestPos:angular.copy(nearest.pos)})
    }
    removeHouse() {
        // Remove the last house to avoid visual inconsistency (house links)
        var idx = this.houses.length-1;
        this.houses.splice(idx, 1);
    }
    update() {

        //Math.random()>0.5?this.addHouse():this.removeHouse();

        // Call update on connected nodes
        for (var n in this.neighbors) {
            var node = this.neighbors[n];
            this._setLocalSupplyAndDemand(node);
            node.update(this);
        }
        // Update items price according to supply and demand
        var pricePercentVariationFactor = 0.01;
        var pricePercentVariationRange = [-50, 200];
        for (var i in this.itemList) {
            var item = this.itemList[i];
            var stock = item.sellerQueue.length,
                demand = item.buyerQueue.length;
            item.trend = demand - stock;

            // Update price percent variation
            if (!item.trend) { // stock == demand == 0
                // tend to 0 to return to base price
                item.pricePercentVariation += pricePercentVariationFactor*Math.sign(item.pricePercentVariation)*-1;
            } else {
                // reduce price if stock, raise price if demand
               item.pricePercentVariation += pricePercentVariationFactor*item.trend; 
            }

            // Clamp variation
            item.pricePercentVariation = (item.pricePercentVariation < pricePercentVariationRange[0])
                                         ? pricePercentVariationRange[0]
                                         : (item.pricePercentVariation > pricePercentVariationRange[1])
                                           ? pricePercentVariationRange[1]
                                           : item.pricePercentVariation;
            // Update price
            item.currentPrice = item.resource.basePrice + Math.round(item.resource.basePrice*item.pricePercentVariation/100);
        }

        /* Update population satisfaction, number and demand
        */
        // Population demand
        //if (this.population>0) {
            for (var n in this.populationNeeds) {
                var need = this.populationNeeds[n];
                var item = this._marketItem(need.resource);
                item.localdemand = true;
                item.popDemandCounter = item.popDemandCounter || 0;

                // Surplus can happen when population left
                var demandSurplus = (item.popDemandCounter - this.population);
                for (var i = demandSurplus; i>0; i--) {
                    var orderIdx = item.buyerQueue.findIndex(function(e) {return e.fromPop});
                    item.buyerQueue.splice(orderIdx, 1);
                    item.popDemandCounter--;
                }

                var weightFactor = 3;

                //if (!item.saturatedDemand) {
                if (demandSurplus < 0) {
                    item.needCounter += this.population * (need.weight/weightFactor);
                    if (item.needCounter >= 100) {
                        item.popDemandCounter++;
                        this.demand(need.resource, function(resource) {this.getItem(resource).popDemandCounter--}.bind(this), 1);
                        item.needCounter -= 100;
                    }
                }

                 // Population stop demanding this resource because previous demands are not satisfied
                 //item.saturatedDemand = (item.popDemandCounter > this.population);
            }
        //}

        // TODO satisfaction : better and explanation
/*        var totalPriceVariation = 0;
        console.log('## total price variation')
        for (var n in this.populationNeeds) {
            var need = this.populationNeeds[n];
            var item = this.itemList.find(function(e) {return e.resource == need.resource});
            console.log(item.pricePercentVariation)
            totalPriceVariation += item ? item.pricePercentVariation : 0;
        }
        console.log("===> " + totalPriceVariation);
        var meanVariation = totalPriceVariation/this.populationNeeds.length;
        console.log("===> " + meanVariation);
        var variationDomain = [0,20];
        console.log("===> " + mathUtils.normalize(-meanVariation, variationDomain));
        this.satisfaction = Math.round(mathUtils.normalize(-meanVariation, variationDomain)*100);

        // Method 2 : depends on demand
        var totalSatisfied = 0;
        for (var n in this.populationNeeds) {
            var need = this.populationNeeds[n];
            var item = this.itemList.find(function(e) {return e.resource == need.resource});
            var needSatisfaction = item.pricePercentVariation < 0 && !item.buyerQueue.length;
            totalSatisfied += needSatisfaction ? 1 : 0;
        }
        var satisfactionRatio = totalSatisfied/this.populationNeeds.length;
        this.satisfaction = satisfactionRatio*100;*/

        // Method 3 : fixed values depending on demand/stock and price
        var totalSatisfaction = 0;
        var unsatisfiedFlag = 0;
        for (var n in this.populationNeeds) {
            var need = this.populationNeeds[n];
            var item = this.itemList.find(function(e) {return e.resource == need.resource});

            var supply = item.sellerQueue.length,
                demand = item.buyerQueue.length;

            var resourceSatisfaction = Math.round(item.pricePercentVariation) < 0
                                         ? supply ? 100 : demand ? 25 : 50
                                         : supply ? 25 : demand ? 0 : 25

            if ((resourceSatisfaction < 100) && !item.resource.isVital && !unsatisfiedFlag) {
                unsatisfiedFlag = 1;
            } else {
                totalSatisfaction += resourceSatisfaction;
            }

            /*if (Math.round(item.pricePercentVariation) > 0 && item.buyerQueue.length) {
                totalSatisfaction = 0;
                break;
            }*/
        }
        this.satisfaction = totalSatisfaction/(this.populationNeeds.length - unsatisfiedFlag);

        // Update population
        var counterThreshold = 30;
        if (this.satisfaction>90) {
            this.satisfactionCounter++;
            if (this.satisfactionCounter >= counterThreshold) {
                this.population++;
                this.addHouse();
                this.satisfactionCounter = 0;
            }
        } else if (this.satisfaction<10) {
            this.satisfactionCounter--;
            if (this.satisfactionCounter <= -counterThreshold) {
                if (this.population){
                    this.population--;
                    this.removeHouse();
                }
                this.satisfactionCounter = 0;
            }
        } else {
            this.satisfactionCounter = 0;
        }
    }
}
