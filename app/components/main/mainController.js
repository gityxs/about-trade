angular.module('myApp')

.controller('TraderController', ['traderService', 'routeService', function(traderService, routeService) {
    var self = this;
    self.traders = traderService.traders;
    self.routes = routeService.routes;
    self.info = traderService.info;
    self.canHire = traderService.canHire;

    self.newTrader = function() {
        if (traderService.canHire()) {
            self.selectedTrader = traderService.newTrader();
        }
    };


}])

.controller('RouteController', ['$scope', 'routeService', 'stateService', function($scope, routeService, stateService) {
    var self = this;
    self.routes = routeService.routes;

    self.selectedRoute = null;
    self.selectedStep = null;

    self.newRoute = function() {
        self.selectedRoute = routeService.newRoute();
        self.routeChanged();
        self.addSelectedRouteStep();
    };
    self.addSelectedRouteStep = function() {
        self.selectedStep = routeService.addRouteStep(self.selectedRoute);
        self.routeUpdated();
    }
    self.removeSelectedRouteStep = function(idx) {
        self.selectedRoute.steps.splice(idx, 1);
        self.routeUpdated();
    }
    self.setSlot = function(resource) {
        var freeSlot = self.selectedStep.slots.find(function(e) {return !e.resource});
        if (freeSlot) {
            freeSlot.resource = resource;
        }
    }
    self.routeChanged = function() {
        stateService.onRouteSelected(self.selectedRoute);
    }
    self.routeUpdated = function() {
        self.selectedRoute.updatetime = Date.now();
        routeService.updateLinks();
    }

    $scope.$watch(function() {return stateService.selectedNode}, function(a,b) {
        if (self.selectedStep && a && a.constructor.name == 'Market') {
            self.selectedStep.market = a;
            self.routeUpdated();
        }
    }, false)

    $scope.$watch(function() {return stateService.selectedMenu}, function(a,b) {
        if (a!='routes') {
            self.selectedRoute = null;
            self.selectedStep = null;
            self.routeChanged();
        }
    }, false)
}])

.controller('MainController', ['$scope', '$http', '$uibModal', 'mainService', 'stateService', 'traderService', 'playerService', 'routeService',
    function ($scope, $http, $uibModal, mainService, stateService, traderService, playerService, routeService) {

    var main = this;

    /* TUTORIAL */
    $http.get('app/data/tutorial.json').then(function(res) {
        main.IntroOptions.steps = res.data.steps;
        main.startTutorial();
    })
    main.BeforeChangeEvent = function (targetElement, scope) {
        var idx = this._currentStep,
            item = this._introItems[idx],
            step = this._options.steps[idx];
       /*
            Check if a DOM element is associated to this step
            If not, it can be:
                - the wanted behavior
                - the element wasn't in the DOM when intro started
            We look if an element is associated and now exists in the DOM
            In this case we associate it
        */
        if (item.position == 'floating') {
            var elem = document.querySelector(step.element);
            if (elem) {
                item.element = elem;
                item.position = step.position;
            }
        }
    };
    main.IntroOptions = {
        showStepNumbers: false,
        exitOnOverlayClick: false,
        showBullets: false,
        showProgress: true,
    }

    main.text = mainService.text;
    main.nodes = mainService.nodes;
    main.nodeModels = mainService.nodeModels;
    main.populationNeeds = mainService.populationNeeds;
    /*main.playerResources = mainService.playerResources;*/
    main.marketLinks = routeService.marketLinks;
    main.state = stateService;
    main.traders = traderService.traders;
    main.player = playerService;
    main.step = 0;
    main.focusNode = null;
    main.conf = mainService.conf;
    main.gameSpeedBase = 1000;
    main.gameSpeedMult = 1;
    main.conf.gameSpeed = main.gameSpeedBase;

    // options
    main.colorblindMode = false;
    main.displayTradeRoutes = true;

    // this will be bound to riGraph directive api
    main.worldView = null;

    var selectedModel;

    main.changeSpeed = function() {
        main.gameSpeedMult *= 2;
        if (main.gameSpeedMult>4) {
            main.gameSpeedMult=0.5;
        }
        main.conf.gameSpeed = main.gameSpeedBase/main.gameSpeedMult;
        if (main.running) {
            main.stop();
            main.run();
        }
    }

    main.menuSelected = function(menu) {
        //main.selectNode(null);
        stateService.onNodeSelected(null);
        main.unselectModel()
        stateService.selectedMenu = menu;
    }

    main.showDetails = function(node) {
        //main.focusNode = node;
        //$scope.$apply();
    }

    function _selectNode(node) {
        main.focusNode = node;
        stateService.onNodeSelected(node);
    }

    main.selectNode = function(node) {
        _selectNode(node);
        $scope.$apply();
    }

    main.addNode = function(pos) {
        if (!selectedModel) {return}
        if (!selectedModel.isValidPos(pos)) {return}

        var newNode = mainService.addNode(selectedModel, pos);

        _selectNode(newNode);

        main.unselectModel();

        $scope.$apply();
    }

    main.removeNode = function(node) {
        console.log("REMOVE NODE");
        console.log(node);
        _selectNode(null);
        mainService.removeNode(node);
        //$scope.$apply();
    }

    main.selectModel = function(model) {
        if (model.isDisabled()) {
            return;
        }
        // If already selected then unselect
        if (model.selected) {
            main.unselectModel();
            return;
        }
        selectedModel && (selectedModel.selected = false);
        model.selected = true;
        selectedModel = model;
        main.ghost = model;
    }

    main.unselectModel = function() {
        //model.selected = false;
        selectedModel && (selectedModel.selected = false);
        selectedModel = null;
        main.ghost = null;
    }

    main.showModelDetails = function(model) {
        return model.selected || model.hovered;
    }

    /* Turn management */
    var runInterval;

    main.run = function() {
        runInterval = setInterval(function() {
            $scope.$apply(main.nextStep);
        }, main.conf.gameSpeed);
        main.running = true;
    }

    main.stop = function() {
        clearInterval(runInterval);
        main.running = false;
    }

    main.nextStep = function() {
        main.step++;
/*        mainService.resetResourcesStats();
        processNodes();*/
    
        var advances = mainService.manageAdvances(main.step);
        if (advances) {
            var wasRunning = main.running;
            main.stop();
            var modalAdvances = $uibModal.open({
              animation: true,
              ariaLabelledBy: 'modal-title',
              ariaDescribedBy: 'modal-body',
              backdrop : 'static',
              templateUrl: 'app/components/advance/modal.html',
              controller: 'ModalAdvancesCtrl',
              controllerAs: '$ctrl',
              //size: 'lg',
              //appendTo: parentElem,
              resolve: {
                advances: function () {
                  return advances;
                }
              }
            });

            modalAdvances.result.then(function () {
              if (wasRunning) {
                main.run();
              }
            }, function () {
            });
        }

        mainService.update();
        traderService.update();
    }

    main.restart = function() {
        main.stop();
        main.step=0;
        main.focusNode = null;
        stateService.onNodeSelected(null);
        main.unselectModel();

        main.worldView.clear();
        traderService.clear();
        routeService.clear();
        mainService.newGame();
    }

}])


.controller('ModalAdvancesCtrl', function ($uibModalInstance, advances) {
  var $ctrl = this;
  $ctrl.advances = advances;
/*  $ctrl.selected = {
    item: $ctrl.items[0]
  };*/

  $ctrl.ok = function () {
    $uibModalInstance.close();
  };

  $ctrl.cancel = function () {
    $uibModalInstance.dismiss('cancel');
  };
})

.directive('resourceIcon', [function() {
    return {
        restrict: 'E',
        scope: {
            'resource' : '='
        },
        template:'<div class="icon-resource" style="background-color:{{resource?resource.color:\'white\'}}">{{resource.symbol}}</div>'
    }
}])

.directive('balance', [function() {
    return {
        restrict: 'E',
        scope: {
            'value' : '='
        },
        template:'<span ng-if="value!=0" ng-style="{color:value>0?\'#5cb85c\':\'#d9534f\'}"><span  class="glyphicon glyphicon-arrow-{{value>0 ? \'up\' : \'down\'}}"  aria-hidden="true"></span>{{value>0?"+":""}}{{value}}</span>'
    }
}])

;