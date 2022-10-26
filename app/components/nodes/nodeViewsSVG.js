Node.prototype.svgViewEnter = function(elem) {
    elem.append('circle')
            .attr({
                r : this.size
            })
            .style({
                fill : this.color
            });
    return elem;
};
Node.prototype.svgViewUpdate = function(elem) {
    elem.classed('working', this.connected && !this.stopped);
};

Exploitation.prototype.svgViewEnter = function(elem) {
    elem.classed('exploitation', true)

    // Gear
    var arc = d3.svg.arc()
                .outerRadius(this.size + 4)
                .innerRadius(this.size + 3);

    var pie = d3.layout.pie()
        .sort(null)
        .value(function() {return 1})
        .padAngle(2*Math.PI/16);

    elem.append('g')
            .attr("class", "g-arcs")
        .selectAll(".arc")
            .data(pie(d3.range(2)))
            .enter().append("path")
                .attr("class", "arc")
                .attr("d", arc);

    Node.prototype.svgViewEnter.call(this, elem);

    // Label
    elem.append('text')
        .attr('class', 'resource-label-text outline')
    elem.append('text')
        .attr('class', 'resource-label-text')
    elem.selectAll('.resource-label-text')
        .text(this.resource.symbol)
        .attr('dy', '.3em')

    return elem;
};
Exploitation.prototype.svgViewUpdate = function(elem) {
    elem.classed('connected', this.connected);
    elem.classed('working', this.connected && !this.stopped);
};



Workshop.prototype.svgViewEnter = function(elem) {

    // Gear
    var arc = d3.svg.arc()
                .outerRadius(this.size + 2)
                .innerRadius(0);

    var pie = d3.layout.pie()
        .sort(null)
        .value(function() {return 1})
        .padAngle(2*Math.PI/16);

    elem.append('g')
            .attr("class", "g-arcs")
        .selectAll(".arc")
            .data(pie(d3.range(8)))
            .enter().append("path")
                .attr("class", "arc")
                .attr("d", arc);

    elem.append('g')
        .attr("class", "center-pie")


    //Node.prototype.svgViewEnter.call(this, elem);
    return elem;
};
Workshop.prototype.svgViewUpdate = function(elem) {
    elem.classed('working', this.producing);

    // Node center : colors pie depending on produced resources
    var arc = d3.svg.arc()
                .outerRadius(this.size)
                .innerRadius(0)
    var centerPie = d3.layout.pie()
        .sort(null)
        .value(function() {return 1})
    var arcs = elem.select('.center-pie')
                .selectAll(".arc")
                    .data(centerPie(this.products));

    arcs.enter()
            .append("path")
                .attr("class", "arc")
                .style('fill', function(d) {return d.data.resource.color});
    arcs.attr("d", arc);

    // Labels
    var labels = elem.selectAll('.resource-label').data(centerPie(this.products));
    var newLabels = labels.enter().append('g').attr('class', 'resource-label');
    newLabels
        .append('text')
            .attr({
                'class' : 'resource-label-text outline',
                dy : ".3em"
            })
    newLabels
        .append('text')
            .attr({
                'class' : 'resource-label-text',
                dy : ".3em"
            })

    labels.selectAll('.resource-label-text')
        .text(function(d) {return d.data.resource.symbol})
        .style('font-size', (15-this.products.length)+'px')

    if (this.products.length>1) {
        labels.attr('transform', function (d) {
            var centroid = arc.centroid(d);
            return "translate(" + centroid + ")";
        });
    }
};

Building.prototype.svgViewEnter = function(elem) {
    elem.style({
                'fill': 'white',
                'stroke-width' : 2
            })
    Node.prototype.svgViewEnter.call(this, elem);
    elem
        
        .append('g')
            .attr('class', 'symbol')
        .append('g')
            .attr('transform', (this.symbol=="triangle-up")?'translate(0,-3)':'')
            .append('path')
                .attr("d", d3.svg.symbol().type(this.symbol).size(180));
    /*elem.append('circle').attr('r', 7)*/
    return elem;
}

Market.prototype.svgViewEnter = function(elem) {
    elem.classed('market', true)

    elem.append('circle')
                .attr({
                    class : 'area',
                    r : this.areaRadius
                });
    var center = elem.append('circle')
        .attr({
            class : 'center',
            r : 0
        })
    center//.transition().duration(500).ease('elastic')
        .attr({
            r : this.size
        })
    elem.append('circle')
        .attr({
            class : 'inner-decoration',
            r : 0,
        })
        .style('pointer-events', 'none')
        .transition().duration(500).ease('elastic')
        .attr({
            r : this.size - 6
        });

    return center;
};
Market.prototype.svgViewUpdate = function(elem) {
    var market = this;

     /* house */
    var houses = elem.selectAll('.house').data(this.houses);
    houses.enter()
        /*.append('rect')
        .attr({
            class : 'house',
            x : function(d) {return d.pos.x - d.size - market.pos.x},
            y : function(d) {return d.pos.y - d.size - market.pos.y},
            width : function(d) {return d.size*2},
            height : function(d) {return d.size*2},
        })*/
        .append('circle')
        .attr({
            class : 'house',
            cx : function(d) {return d.pos.x - market.pos.x},
            cy : function(d) {return d.pos.y - market.pos.y},
            r : 0
        })
        .transition().duration(500).ease('elastic')
        .attr({
            r : function(d) {return d.size},
        })

    houses.exit().remove();

    /* agents */
    var agents = elem.selectAll('.agent').data(this.traders);
    var newAgents = agents.enter()
        .append('g')
            .attr('class', 'agent');

    newAgents.append('text')
        .attr({
            'class' : 'agent-label-outline',
            'dy' : '.3em'
        })
    newAgents.append('text')
        .attr({
            'class' : 'agent-label',
            'dy' : '.3em'
        })

    function agentName(d) {return "\u25C0 " + d.name}
    agents.select('.agent-label-outline').text(agentName)
    agents.select('.agent-label').text(agentName)

    agents
        .attr('transform', function(d,i) {
            //return 'translate(' + [node.pos.x+node.size+5, node.pos.y+i*10 - (node.traders.length-1)*5] + ')'
            return 'translate(' + [market.size+5, i*10 - (market.traders.length-1)*5] + ')'
                   //+ 'rotate(-90)'
        })

    /* Render agent buy and sell  orders WIP*/
/*    newAgents.append('rect')
        .attr({
            x : -5,
            y : 0,
            width : 10,
            height : 30
        })


    agents.each(function(agent) {
        var resources = d3.select(this).selectAll('.resource').data(agent.orders.sell);
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
    })*/

    agents.exit().remove()
};