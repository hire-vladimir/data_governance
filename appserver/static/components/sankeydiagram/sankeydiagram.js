// Sankey Diagram
// vs@splunk.com 4/23/14
// based on work by http://bost.ocks.org/mike/sankey/

//logging, uncoment to disable
console.log = function() {}
console.warn = function() {}
console.debug = function() {}
console.error = function() {}

define(function(require, exports, module) {

    var _ = require('underscore');
    var d3 = require("../d3/d3");
    var SimpleSplunkView = require("splunkjs/mvc/simplesplunkview");

    require("css!./sankeydiagram.css");

	d3.sankey = function() {
	  var sankey = {},
	      nodeWidth = 24,
	      nodePadding = 8,
	      size = [1, 1],
	      nodes = [],
	      links = [];

	  sankey.nodeWidth = function(_) {
	    if (!arguments.length) return nodeWidth;
	    nodeWidth = +_;
	    return sankey;
	  };

	  sankey.nodePadding = function(_) {
	    if (!arguments.length) return nodePadding;
	    nodePadding = +_;
	    return sankey;
	  };

	  sankey.nodes = function(_) {
	    if (!arguments.length) return nodes;
	    nodes = _;
	    return sankey;
	  };

	  sankey.links = function(_) {
	    if (!arguments.length) return links;
	    links = _;
	    return sankey;
	  };

	  sankey.size = function(_) {
	    if (!arguments.length) return size;
	    size = _;
	    return sankey;
	  };

	  sankey.layout = function(iterations) {
	    computeNodeLinks();
	    computeNodeValues();
	    computeNodeBreadths();
	    computeNodeDepths(iterations);
	    computeLinkDepths();
	    return sankey;
	  };

	  sankey.relayout = function() {
	    computeLinkDepths();
	    return sankey;
	  };

	  sankey.link = function() {
	    var curvature = .5;

	    function link(d) {
	      var x0 = d.source.x + d.source.dx,
	          x1 = d.target.x,
	          xi = d3.interpolateNumber(x0, x1),
	          x2 = xi(curvature),
	          x3 = xi(1 - curvature),
	          y0 = d.source.y + d.sy + d.dy / 2,
	          y1 = d.target.y + d.ty + d.dy / 2;
	      return "M" + x0 + "," + y0
	           + "C" + x2 + "," + y0
	           + " " + x3 + "," + y1
	           + " " + x1 + "," + y1;
	    }

	    link.curvature = function(_) {
	      if (!arguments.length) return curvature;
	      curvature = +_;
	      return link;
	    };

	    return link;
	  };

	  // Populate the sourceLinks and targetLinks for each node.
	  // Also, if the source and target are not objects, assume they are indices.
	  function computeNodeLinks() {
	    nodes.forEach(function(node) {
	      node.sourceLinks = [];
	      node.targetLinks = [];
	    });
	    links.forEach(function(link) {
	      var source = link.source,
	          target = link.target;

	      if (typeof source === "number") source = link.source = nodes[link.source];
	      if (typeof target === "number") target = link.target = nodes[link.target];
	      source.sourceLinks.push(link);
	      target.targetLinks.push(link);
	    });
	  }

	  // Compute the value (size) of each node by summing the associated links.
	  function computeNodeValues() {
	    nodes.forEach(function(node) {
	      node.value = Math.max(
	        d3.sum(node.sourceLinks, value),
	        d3.sum(node.targetLinks, value)
	      );
	    });
	  }

	  // Iteratively assign the breadth (x-position) for each node.
	  // Nodes are assigned the maximum breadth of incoming neighbors plus one;
	  // nodes with no incoming links are assigned breadth zero, while
	  // nodes with no outgoing links are assigned the maximum breadth.
	  function computeNodeBreadths() {
	    var remainingNodes = nodes,
	        nextNodes,
	        x = 0;

	    while (remainingNodes.length) {
	      nextNodes = [];
	      remainingNodes.forEach(function(node) {
	        node.x = x;
	        node.dx = nodeWidth;
	        node.sourceLinks.forEach(function(link) {
	          nextNodes.push(link.target);
	        });
	      });
	      remainingNodes = nextNodes;
	      ++x;
	    }

	    //
	    moveSinksRight(x);
	    scaleNodeBreadths((size[0] - nodeWidth) / (x - 1));
	  }

	  function moveSourcesRight() {
	    nodes.forEach(function(node) {
	      if (!node.targetLinks.length) {
	        node.x = d3.min(node.sourceLinks, function(d) { return d.target.x; }) - 1;
	      }
	    });
	  }

	  function moveSinksRight(x) {
	    nodes.forEach(function(node) {
	      if (!node.sourceLinks.length) {
	        node.x = x - 1;
	      }
	    });
	  }

	  function scaleNodeBreadths(kx) {
	    nodes.forEach(function(node) {
	      node.x *= kx;
	    });
	  }

	  function computeNodeDepths(iterations) {
	    var nodesByBreadth = d3.nest()
	        .key(function(d) { return d.x; })
	        .sortKeys(d3.ascending)
	        .entries(nodes)
	        .map(function(d) { return d.values; });

	    //
	    initializeNodeDepth();
	    resolveCollisions();
	    for (var alpha = 1; iterations > 0; --iterations) {
	      relaxRightToLeft(alpha *= .99);
	      resolveCollisions();
	      relaxLeftToRight(alpha);
	      resolveCollisions();
	    }

	    function initializeNodeDepth() {
	      var ky = d3.min(nodesByBreadth, function(nodes) {
	        return (size[1] - (nodes.length - 1) * nodePadding) / d3.sum(nodes, value);
	      });

	      nodesByBreadth.forEach(function(nodes) {
	        nodes.forEach(function(node, i) {
	          node.y = i;
	          node.dy = node.value * ky;
	        });
	      });

	      links.forEach(function(link) {
	        link.dy = link.value * ky;
	      });
	    }

	    function relaxLeftToRight(alpha) {
	      nodesByBreadth.forEach(function(nodes, breadth) {
	        nodes.forEach(function(node) {
	          if (node.targetLinks.length) {
	            var y = d3.sum(node.targetLinks, weightedSource) / d3.sum(node.targetLinks, value);
	            node.y += (y - center(node)) * alpha;
	          }
	        });
	      });

	      function weightedSource(link) {
	        return center(link.source) * link.value;
	      }
	    }

	    function relaxRightToLeft(alpha) {
	      nodesByBreadth.slice().reverse().forEach(function(nodes) {
	        nodes.forEach(function(node) {
	          if (node.sourceLinks.length) {
	            var y = d3.sum(node.sourceLinks, weightedTarget) / d3.sum(node.sourceLinks, value);
	            node.y += (y - center(node)) * alpha;
	          }
	        });
	      });

	      function weightedTarget(link) {
	        return center(link.target) * link.value;
	      }
	    }

	    function resolveCollisions() {
	      nodesByBreadth.forEach(function(nodes) {
	        var node,
	            dy,
	            y0 = 0,
	            n = nodes.length,
	            i;

	        // Push any overlapping nodes down.
	        nodes.sort(ascendingDepth);
	        for (i = 0; i < n; ++i) {
	          node = nodes[i];
	          dy = y0 - node.y;
	          if (dy > 0) node.y += dy;
	          y0 = node.y + node.dy + nodePadding;
	        }

	        // If the bottommost node goes outside the bounds, push it back up.
	        dy = y0 - nodePadding - size[1];
	        if (dy > 0) {
	          y0 = node.y -= dy;

	          // Push any overlapping nodes back up.
	          for (i = n - 2; i >= 0; --i) {
	            node = nodes[i];
	            dy = node.y + node.dy + nodePadding - y0;
	            if (dy > 0) node.y -= dy;
	            y0 = node.y;
	          }
	        }
	      });
	    }

	    function ascendingDepth(a, b) {
	      return a.y - b.y;
	    }
	  }

	  function computeLinkDepths() {
	    nodes.forEach(function(node) {
	      node.sourceLinks.sort(ascendingTargetDepth);
	      node.targetLinks.sort(ascendingSourceDepth);
	    });
	    nodes.forEach(function(node) {
	      var sy = 0, ty = 0;
	      node.sourceLinks.forEach(function(link) {
	        link.sy = sy;
	        sy += link.dy;
	      });
	      node.targetLinks.forEach(function(link) {
	        link.ty = ty;
	        ty += link.dy;
	      });
	    });

	    function ascendingSourceDepth(a, b) {
	      return a.source.y - b.source.y;
	    }

	    function ascendingTargetDepth(a, b) {
	      return a.target.y - b.target.y;
	    }
	  }

	  function center(node) {
	    return node.y + node.dy / 2;
	  }

	  function value(link) {
	    return link.value;
	  }

	  return sankey;
	};

    var SankeyDiagram = SimpleSplunkView.extend({
        className: "splunk-toolkit-sankey-diagram",

        options: {
            managerid: null,   
            data: "preview", 
            sourceField: null,
			destinationField: null,
            valueField: 'count',
			drilldown: null,
			height: 400
        },

        output_mode: "json",

        initialize: function() {
          /*  _.extend(this.options, {
                formatName: _.identity,
                formatTitle: function(d) { console.log(d);
                    return (d.source.name + ' -> ' + d.target.name + ': ' + d.value); 
                }
            });*/
            SimpleSplunkView.prototype.initialize.apply(this, arguments);

            //this.settings.enablePush("value");

            // in the case that any options are changed, it will dynamically update
            // without having to refresh. copy the following line for whichever field
            // you'd like dynamic updating on
           

            // Set up resize callback. The first argument is a this
            // pointer which gets passed into the callback event
            $(window).resize(this, _.debounce(this._handleResize, 0));
        },

        _handleResize: function(e){
            
            // e.data is the this pointer passed to the callback.
            // here it refers to this object and we call render()
            e.data.render();
        },

        createView: function() {
            var margin = {top: 0, right: 0, bottom: 0, left: 0};
            var availableWidth = parseInt(this.settings.get("width") || this.$el.width());
            var availableHeight = parseInt(this.settings.get("height") || this.$el.height());

            this.$el.html("");
			
            var svg = d3.select(this.el)
                .append("svg")
                .attr("width", availableWidth)
                .attr("height", availableHeight)
                .attr("pointer-events", "all");
                
            // The returned object gets passed to updateView as viz
            return { container: this.$el, svg: svg, margin: margin };
        },

        // making the data look how we want it to for updateView to do its job
        formatData: function(data) {
            // getting settings
            var sourceField = this.settings.get('sourceField'),
				destinationField = this.settings.get('destinationField'),
            	valueField = this.settings.get('valueField'),
				collection=data, 
				nodes=[], links=[];
				
            for (var i=0; i < collection.length; i++) {
				//create list of links
				if (vContains(nodes,"to_"+collection[i][sourceField])==-1){
					nodes.push({'name':"to_"+collection[i][sourceField]});
				}
				if (vContains(nodes,"fm_"+collection[i][destinationField])==-1){
					nodes.push({'name':"fm_"+collection[i][destinationField]});
				}
				links.push({"source":vContains(nodes,"to_"+collection[i][sourceField]), "target":vContains(nodes,"fm_"+collection[i][destinationField]), "value":collection[i][valueField]});
            }
			
			for (var i = 0; i < nodes.length; i++) {
				nodes[i].name=nodes[i].name.replace(/fm_|to_/g,"");
			}
			
			var sankeyChart = {'nodes':nodes, 'links':links};
			console.debug("my sankey: ", sankeyChart);
			return sankeyChart;
        },

        updateView: function(viz, data) {
			var that = this;
            var svg = $(viz.svg[0]).empty();

            var format = d3.format(",d");
            var color = d3.scale.category20c();

			var margin = {top: 1, right: 1, bottom: 1, left: 1},
				containerHeight = this.$el.height(),
				containerWidth = this.$el.width(),
			    width = containerWidth + margin.left,
			    height = containerHeight + margin.bottom;
			
            var graph = viz.svg
                .append("g")
                .attr("transform", "translate(" + viz.margin.left + "," + viz.margin.top + ")")
				.attr("width", width)
				.attr("height", height);	

			var sankey = d3.sankey()
			    .nodeWidth(15)
			    .nodePadding(10)
			    .size([containerWidth, containerHeight])
		        .nodes(data.nodes)
		        .links(data.links)
		        .layout(32);
				
            svg.height(height).width(width);
			
			var path = sankey.link();
					
		    var link = graph.selectAll(".link")
		        .data(data.links)
		        .enter().append("path")
		        .attr("class", "link")
		        .attr("d", path)
		        .style("stroke-width", function(d) { return Math.max(1, d.dy); })
		        .sort(function(a, b) { return b.dy - a.dy; });

		    link.append("title")
		        .text(function(d) { return d.source.name + " → " + d.target.name + "\n" + format(d.value); });

		    var node = graph.selectAll(".node")
		        .data(data.nodes)
		        .enter().append("g")
		        .attr("class", "node")
		        .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; })
		        /*.call(d3.behavior.drag()
		        .origin(function(d) { return d; })
		        .on("dragstart", function() { this.parentNode.appendChild(this); })
		        .on("drag", dragmove))*/;

			node.append("rect")
				.attr("height", function(d) { return d.dy; })
				.attr("width", sankey.nodeWidth())
				.style("fill", function(d) { return d.color = color(d.name.replace(/ .*/, "")); })
				.style("stroke", function(d) { return d3.rgb(d.color).darker(2); })
				.append("title")
				.text(function(d) { return d.name + "\n" + format(d.value); });

			node.append("text")
				.attr("x", -6)
				.attr("y", function(d) { return d.dy / 2; })
				.attr("dy", ".35em")
				.attr("text-anchor", "end")
				.attr("transform", null)
				.text(function(d) { return d.name; })
				.filter(function(d) { return d.x < width / 2; })
				.attr("x", 6 + sankey.nodeWidth())
				.attr("text-anchor", "start");

			function dragmove(d) {
				d3.select(this).attr("transform", "translate(" + d.x + "," + (d.y = Math.max(0, Math.min(height - d.dy, d3.event.y))) + ")");
				sankey.relayout();
				link.attr("d", path);
			}
			
			//optional drilldown into field clicked
			if (that.settings.get('drilldown') != null) {
	            node.style("cursor", "hand").on('click', function(e) { 
					 //if x=0 is source of the event, x>0 is the target
					 var drilldownClick = (e.x==0) ? that.settings.get('sourceField') : that.settings.get('destinationField'),
					 	drilldownUri = that.settings.get('drilldown') /*+ "?" */+ drilldownClick + "=" + e.name;
					 console.debug("click uri: ", drilldownUri);
					 window.location.href = drilldownUri;
	             });
			 }
        }
    });
    return SankeyDiagram;
});

function vContains(p,v){
	var ret =-1
	for (var i = 0; i < p.length; i++) {
	 if (p[i].name == v) 
	 { 
		 ret=i; 
		 break; 
	 }
	}
	return ret;
}




