(function(f, define){
    define([
        "./kendo-chart",
        "../../kendo.data",
        "../../kendo.dataviz.core",
        "../../kendo.dataviz.themes",
        "../../kendo.drawing",
        "../../kendo.userevents"
    ], f);
})(function(){

(function ($, undefined) {

    var NS = ".kendoChart";
    var kendo = window.kendo;
    var Class = kendo.Class;
    var outerWidth = kendo._outerWidth;
    var outerHeight = kendo._outerHeight;
    var dataviz = kendo.dataviz;
    var constants = dataviz.constants;
    var KendoChart = dataviz.Chart;
    var SeriesBinder = dataviz.SeriesBinder;
    var Widget = kendo.ui.Widget;
    var DataSource = kendo.data.DataSource;
    var deepExtend = kendo.deepExtend;
    var defined = dataviz.defined;
    var getField = dataviz.getField;
    var InstanceObserver = dataviz.InstanceObserver;
    var inArray = dataviz.inArray;
    var services = dataviz.services;
    var proxy = $.proxy;
    var isArray = $.isArray;
    var template = kendo.template;

    var MOUSELEAVE_NS = "mouseleave" + NS;
    var AXIS_LABEL_CLICK = constants.AXIS_LABEL_CLICK;
    var LEGEND_ITEM_CLICK = constants.LEGEND_ITEM_CLICK;
    var LEGEND_ITEM_HOVER = constants.LEGEND_ITEM_HOVER;
    var SERIES_CLICK = constants.SERIES_CLICK;
    var SERIES_HOVER = constants.SERIES_HOVER;
    var PLOT_AREA_CLICK = constants.PLOT_AREA_CLICK;
    var PLOT_AREA_HOVER = constants.PLOT_AREA_HOVER;
    var DRAG = constants.DRAG;
    var DRAG_END = constants.DRAG_END;
    var DRAG_START = constants.DRAG_START;
    var ZOOM_START = constants.ZOOM_START;
    var ZOOM = constants.ZOOM;
    var ZOOM_END = constants.ZOOM_END;
    var SELECT_START = constants.SELECT_START;
    var SELECT = constants.SELECT;
    var SELECT_END = constants.SELECT_END;
    var RENDER = constants.RENDER;
    var NOTE_CLICK = constants.NOTE_CLICK;
    var NOTE_HOVER = constants.NOTE_HOVER;

    var CHANGE = "change";
    var DATABOUND = "dataBound";
    var LEAVE = "leave";

    var VALUE = constants.VALUE;
    var PIE = constants.PIE;
    var DONUT = constants.DONUT;
    var FUNNEL = constants.FUNNEL;

    var Observable = kendo.Observable;
    var TOOLTIP_ANIMATION_DURATION = 150;
    var TOOLTIP_SHOW_DELAY = 100;
    var TOOLTIP_INVERSE = "k-chart-tooltip-inverse";
    var SHARED_TOOLTIP_CLASS = "k-chart-shared-tooltip";

    services.DomEventsBuilder.register({
        create: function(element, events) {
             return new kendo.UserEvents(element, deepExtend({
                 global: true,
                 multiTouch: true,
                 fastTap: true
             }, events));
        }
    });

    var ChartInstanceObserver = InstanceObserver.extend({
        handlerMap: {
            showTooltip: '_showTooltip',
            hideTooltip: '_hideTooltip',
            legendItemClick: '_onLegendItemClick',
            render: '_onRender'
        }
    });

    var Chart = Widget.extend({
        init: function(element, userOptions) {
            var dataSource;

            kendo.destroy(element);

            Widget.fn.init.call(this, element);

            if (userOptions) {
                dataSource = userOptions.dataSource;
                delete userOptions.dataSource;
            }

            this.options =  deepExtend({}, this.options, userOptions);

            this.wrapper = this.element;
            this._attachEvents();

            if (userOptions) {
                userOptions.dataSource = dataSource;
            }

            this.bind(this.events, this.options);
            this._initDataSource(userOptions);

            kendo.notify(this, dataviz.ui);
        },

        events:[
            DATABOUND,
            SERIES_CLICK,
            SERIES_HOVER,
            AXIS_LABEL_CLICK,
            LEGEND_ITEM_CLICK,
            LEGEND_ITEM_HOVER,
            PLOT_AREA_CLICK,
            PLOT_AREA_HOVER,
            DRAG_START,
            DRAG,
            DRAG_END,
            ZOOM_START,
            ZOOM,
            ZOOM_END,
            SELECT_START,
            SELECT,
            SELECT_END,
            NOTE_CLICK,
            NOTE_HOVER,
            RENDER
        ],

        options: {
            name: "Chart",
            renderAs: "",
            theme: "default",
            chartArea: {},
            legend: {},
            categoryAxis: {},
            autoBind: true,
            seriesDefaults: {},
            series: [],
            seriesColors: null,
            tooltip: {},
            transitions: true,
            valueAxis: {},
            plotArea: {},
            title: {},
            xAxis: {},
            yAxis: {},
            panes: [{}],
            pannable: false,
            zoomable: false
        },

        items: function() {
            return $();
        },

        refresh: function() {
            var chart = this;
            var instance = chart._instance;
            instance._applyDefaults(chart.options);
            instance._applySeriesColors();

            chart._bindSeries();
            chart._bindCategories();

            chart.trigger(DATABOUND);
            chart._redraw();
        },

        getSize: function() {
            return kendo.dimensions(this.element);
        },

        redraw: function(paneName) {
            this._size = null;
            this._instance.redraw(paneName);
        },

        setOptions: function(options) {
            var chart = this,
                dataSource = options.dataSource;

            delete options.dataSource;

            Widget.fn._setEvents.call(chart, options);

            this._instance.applyOptions(options, this._getThemeOptions(options));
            this.options = this._instance.options;
            this._tooltip.setOptions(this.options.tooltip);
            this._sourceSeries = null;

            if (dataSource) {
                chart.setDataSource(dataSource);
            }

            if (chart._hasDataSource) {
                chart._onDataChanged();
            } else {
                chart._bindCategories();
                chart.redraw();
            }

            chart._instance.updateMouseMoveHandler();
        },

        setDataSource: function(dataSource) {
            var chart = this;

            chart.dataSource.unbind(CHANGE, chart._dataChangeHandler);
            chart.dataSource = dataSource = DataSource.create(dataSource);
            chart._hasDataSource = true;
            chart._hasData = false;

            dataSource.bind(CHANGE, chart._dataChangeHandler);

            if (chart.options.autoBind) {
                dataSource.fetch();
            }
        },

        destroy: function() {
            var chart = this,
                dataSource = chart.dataSource;

            chart.element.off(NS);

            if (dataSource) {
                dataSource.unbind(CHANGE, chart._dataChangeHandler);
            }

            if (chart._instance) {
                chart._instance.destroy();
                delete this._instance;
            }

            if (this._tooltip) {
                this._tooltip.destroy();
                delete this._tooltip;
            }

            this._destroyCrosshairTooltips();

            Widget.fn.destroy.call(chart);
        },

        findPaneByName: function(name) {
            var panes = this._plotArea.panes;

            for (var idx = 0; idx < panes.length; idx++) {
                if (panes[idx].options.name === name) {
                    return new ChartPane(this, panes[idx]);
                }
            }
        },

        findPaneByIndex: function(idx) {
            var panes = this._plotArea.panes;
            if (panes[idx]) {
                return new ChartPane(this, panes[idx]);
            }
        },

        findSeries: function(callback) {
            var plotArea = this._plotArea;
            var series = plotArea.srcSeries || plotArea.series;
            for (var idx = 0; idx < series.length; idx++) {
                if (callback(series[idx])) {
                    return new ChartSeries(this, series[idx]);
                }
            }
        },

        findSeriesByName: function(name) {
            return this._createSeries({ name: name });
        },

        findSeriesByIndex: function(index) {
            return this._createSeries({ index: index });
        },

        _createSeries: function(options) {
            var seriesOptions = this._seriesOptions(options);
            if (seriesOptions) {
                return new ChartSeries(this, seriesOptions);
            }
        },

        _seriesOptions: function(options) {
            var plotArea = this._plotArea;
            var series = plotArea.srcSeries || plotArea.series;
            var seriesOptions;

            if (defined(options.index)) {
                seriesOptions = series[options.index];
            } else if (defined(options.name)) {
                for (var idx = 0; idx < series.length; idx++) {
                    if (series[idx].name === options.name) {
                        seriesOptions = series[idx];
                        break;
                    }
                }
            }

            return seriesOptions;
        },

        _attachEvents: function() {
             this.element.on(MOUSELEAVE_NS, proxy(this._mouseleave, this));
        },

        _mouseleave: function(e) {
            var instance = this._instance;
            var tooltip = this._tooltip;
            var target = e.relatedTarget;

            if (!(target && $(target).closest(tooltip.element).length) && instance && !instance.handlingTap) {
                instance.hideElements();
            }
        },


        _getThemeOptions: function(userOptions) {
            var themeName = (userOptions || {}).theme;
            if (themeName === "inherit" || themeName === "default-v2") {
                return dataviz.autoTheme().chart;
            }

            if (defined(themeName)) {
                var themes = dataviz.ui.themes || {};
                var theme = themes[themeName] || themes[themeName.toLowerCase()] || {};
                return theme.chart || {};
            }
        },

        _initChart: function() {
            this._createChart(this.options, this._getThemeOptions(this.options));
            this.options = this._instance.options;
        },

        _createChart: function(options, themeOptions) {
            this._instance = new KendoChart(this.element[0], options, themeOptions, {
                observer: new ChartInstanceObserver(this),
                sender: this
            });
        },

        _initDataSource: function(userOptions) {
            var chart = this,
                dataSource = (userOptions || {}).dataSource;

            chart._dataChangeHandler = proxy(chart._onDataChanged, chart);

            chart.dataSource = DataSource
                .create(dataSource)
                .bind("change", chart._dataChangeHandler);

            chart._bindCategories();

            if (dataSource) {
                chart._hasDataSource = true;
            }

            this._initChart();
            this._initTooltip();

            if (dataSource) {
                if (chart.options.autoBind) {
                    chart.dataSource.fetch();
                }
            }
        },

        _destroyCrosshairTooltips: function() {
            var tooltips = this._crosshairTooltips;
            if (tooltips) {
                for (var key in tooltips) {
                    tooltips[key].destroy();
                }
            }
            this._crosshairTooltips = {};
        },

        _getCrosshairTooltip: function(name, index) {
            var tooltips = this._crosshairTooltips = this._crosshairTooltips || {};
            var key = name + index;
            var tooltip = tooltips[key];
            if (!tooltip) {
                tooltip = tooltips[key] = new CrosshairTooltip(this.element);
            }
            return tooltip;
        },

        _showTooltip: function(e) {
            if (e.crosshair) {
                var tooltip = this._getCrosshairTooltip(e.axisName, e.axisIndex);
                tooltip.show(e);
            } else if (this._tooltip) {
                this._tooltip.show(e);
            }
        },

        _hideTooltip: function(e) {
            if (e.crosshair) {
                 var tooltip = this._getCrosshairTooltip(e.axisName, e.axisIndex);
                 tooltip.hide();
            } else if (this._tooltip) {
                this._tooltip.hide(e);
            }
        },

        _onRender: function(e) {
            this._destroyCrosshairTooltips();
            this._copyMembers(e.sender);
            if (!this._hasDataSource || this._hasData || !this.options.autoBind) {
                this.trigger(RENDER);
            }
        },

        _copyMembers: function(instance) {
            this._instance = instance;

            this.options = instance.options;
            this._originalOptions = instance._originalOptions;
            this.surface = instance.surface;
            this._plotArea = instance._plotArea;
            this._model = instance._model;
            this._highlight = instance._highlight;
            this._selections = instance._selections;
            this._pannable = instance._pannable;
            this._zoomSelection = instance._zoomSelection;
            this._mousewheelZoom = instance._mousewheelZoom;
        },

        requiresHandlers: function(names) {
           var events = this._events;
           for (var idx = 0; idx < names.length; idx++) {
               if (defined(events[names[idx]])) {
                   return true;
               }
           }
        },

        _initTooltip: function() {
            this._tooltip = this._createTooltip();

            this._tooltip.bind(LEAVE, proxy(this._tooltipleave, this));
        },

        _onLegendItemClick: function(e) {
            if (!this.trigger(LEGEND_ITEM_CLICK, e)) {
                this._legendItemClick(e.seriesIndex, e.pointIndex);
            }
        },

        _legendItemClick: function(seriesIndex, pointIndex) {
            var chart = this._instance,
                plotArea = chart._plotArea,
                currentSeries = (plotArea.srcSeries || plotArea.series)[seriesIndex];

            if ($.inArray(currentSeries.type, [PIE, DONUT,FUNNEL]) >= 0) {
                var pointVisibility = currentSeries.pointVisibility = currentSeries.pointVisibility || {};
                var visible = pointVisibility[pointIndex];
                pointVisibility[pointIndex] = defined(visible) ? !visible : false;
            } else {
                currentSeries.visible = !currentSeries.visible;
                this._saveGroupVisibleState(currentSeries);
            }

            chart._noTransitionsRedraw();
        },


        _createTooltip: function() {
            return new Tooltip(this.element, this.options.tooltip);
        },

        _tooltipleave: function() {
            var chart = this._instance,
                plotArea = chart._plotArea,
                highlight = chart._highlight;

            plotArea.hideCrosshairs();

            highlight.hide();
        },

        _bindData: function(e) {
            var chart = this,
                options = chart.options,
                series = chart._sourceSeries || options.series,
                seriesIx,
                seriesLength = series.length,
                data = chart.dataSource.view(),
                grouped = (chart.dataSource.group() || []).length > 0,
                processedSeries = [],
                currentSeries;

            for (seriesIx = 0; seriesIx < seriesLength; seriesIx++) {
                currentSeries = series[seriesIx];

                if (chart._isBindable(currentSeries) && grouped) {
                    processedSeries = processedSeries.concat(groupSeries(currentSeries, data));
                    this._applyGroupVisibleState(processedSeries, e);
                } else {
                    processedSeries.push(currentSeries || []);
                }
            }

            chart._sourceSeries = series;
            options.series = processedSeries;
            this._instance._applySeriesColors();

            chart._bindSeries();
            chart._bindCategories();

            this._hasData = true;
        },

        _onDataChanged: function(e) {
            this._bindData(e);

            this.trigger(DATABOUND);
            this._redraw();
        },

        _applyGroupVisibleState: function(processedSeries, e) {
            if (e && e.action) {
                var visibleState = this._groupVisibleState = this._groupVisibleState || {};
                for (var idx = 0; idx < processedSeries.length; idx++) {
                    if (visibleState[processedSeries[idx]._groupValue] === false) {
                        processedSeries[idx].visible = false;
                    }
                }
            } else {
                delete this._groupVisibleState;
            }
        },

        _saveGroupVisibleState: function(series) {
            if (defined(series._groupValue)) {
                if (!this._groupVisibleState) {
                    this._groupVisibleState = {};
                }

                this._groupVisibleState[series._groupValue] = series.visible;
            }
        },

        _bindSeries: function() {
            var chart = this,
                data = chart.dataSource.view(),
                series = chart.options.series,
                seriesIx,
                seriesLength = series.length,
                currentSeries,
                groupIx,
                seriesData;

            for (seriesIx = 0; seriesIx < seriesLength; seriesIx++) {
                currentSeries = series[seriesIx];

                if (chart._isBindable(currentSeries)) {
                    groupIx = currentSeries._groupIx;
                    seriesData = defined(groupIx) ? (data[groupIx] || {}).items : data;

                    if (currentSeries.autoBind !== false) {
                        currentSeries.data = seriesData;
                    }
                }
            }
        },

        _bindCategories: function() {
            var chart = this,
                data = chart.dataSource.view() || [],
                grouped = (chart.dataSource.group() || []).length > 0,
                categoriesData = data,
                options = chart.options,
                definitions = [].concat(options.categoryAxis),
                axisIx,
                axis;

            if (grouped) {
                if (data.length) {
                    categoriesData = data[0].items;
                }
            }

            for (axisIx = 0; axisIx < definitions.length; axisIx++) {
                axis = definitions[axisIx];
                if (axis.autoBind !== false) {
                    chart._bindCategoryAxis(axis, categoriesData, axisIx);
                }
            }
        },

        _bindCategoryAxis: function(axis, data, axisIx) {
            var count = (data || []).length,
                categoryIx,
                category,
                row;

            if (axis.field) {
                axis.categories = [];
                for (categoryIx = 0; categoryIx < count; categoryIx++) {
                    row = data[categoryIx];

                    category = getField(axis.field, row);
                    if (categoryIx === 0) {
                        axis.categories = [category];
                        axis.dataItems = [row];
                    } else {
                        axis.categories.push(category);
                        axis.dataItems.push(row);
                    }
                }
            } else if (this._instance) {
                this._instance._bindCategoryAxisFromSeries(axis, axisIx);
            }
        },

        _isBindable: function(series) {
            var valueFields = SeriesBinder.current.valueFields(series),
                result = true,
                field, i;

            for (i = 0; i < valueFields.length; i++) {
                field = valueFields[i];
                if (field === VALUE) {
                    field = "field";
                } else {
                    field = field + "Field";
                }

                if (!defined(series[field])) {
                    result = false;
                    break;
                }
            }

            return result;
        }
    });

    var proxyMembers = ["getAxis", "findAxisByName", "plotArea", "toggleHighlight", "showTooltip",
        "hideTooltip", "exportVisual", "_resize", "_redraw", "_noTransitionsRedraw", "_legendItemHover", "_eventCoordinates"];

    function createProxyMember(name) {
        Chart.fn[name] = function() {
            var instance = this._instance;
            if (instance) {
                return instance[name].apply(instance, arguments);
            }
        };
    }

    for (var idx = 0; idx < proxyMembers.length; idx++) {
        createProxyMember(proxyMembers[idx]);
    }

    function groupSeries(series, data) {
        var result = [],
            nameTemplate,
            legacyTemplate = series.groupNameTemplate,
            groupIx,
            dataLength = data.length,
            seriesClone;

        if (dataLength === 0) {
            seriesClone = deepExtend({}, series);
            seriesClone.visibleInLegend = false;
            return [seriesClone];
        }

        if (defined(legacyTemplate)) {
            kendo.logToConsole(
                "'groupNameTemplate' is obsolete and will be removed in future versions. " +
                "Specify the group name template as 'series.name'"
            );

            if (legacyTemplate) {
                nameTemplate = template(legacyTemplate);
            }
        } else {
            nameTemplate = template(series.name || "");
            if (nameTemplate._slotCount === 0) {
                nameTemplate = template(defined(series.name) ?
                    "#= group.value #: #= series.name #" :
                    "#= group.value #"
                );
            }
        }

        for (groupIx = 0; groupIx < dataLength; groupIx++) {
            seriesClone = deepExtend({}, series);

            if (!kendo.isFunction(seriesClone.color)) {
                seriesClone.color = undefined;
            }

            seriesClone._groupIx = groupIx;
            seriesClone._groupValue = data[groupIx].value;
            result.push(seriesClone);

            if (nameTemplate) {
                seriesClone.name = nameTemplate({
                    series: seriesClone, group: data[groupIx]
                });
            }
        }

        return result;
    }

    dataviz.ExportMixin.extend(Chart.fn);

    if (kendo.PDFMixin) {
        kendo.PDFMixin.extend(Chart.fn);
    }

    dataviz.ui.plugin(Chart);

    var geom = kendo.geometry;

    var Tooltip = Observable.extend({
        init: function(chartElement, options) {
            var tooltip = this;

            Observable.fn.init.call(tooltip);

            this.setOptions(options);

            tooltip.chartElement = chartElement;

            tooltip.template = Tooltip.template;
            if (!tooltip.template) {
                tooltip.template = Tooltip.template = kendo.template(
                    "<div class='k-tooltip k-chart-tooltip' " +
                    "style='display:none; position: absolute; font: #= d.font #;" +
                    "#if (d.border) {# border: #= d.border.width #px solid; #}#" +
                    "opacity: #= d.opacity #; filter: alpha(opacity=#= d.opacity * 100 #);'>" +
                    "</div>", { useWithBlock: false, paramName: "d" });
            }

            tooltip.element = $(tooltip.template(tooltip.options));

            tooltip.move = proxy(tooltip.move, tooltip);
            tooltip._mouseleave = proxy(tooltip._mouseleave, tooltip);

            var mobileScrollerSelector = kendo.format("[{0}='content'],[{0}='scroller']", kendo.attr("role"));
            tooltip._mobileScroller = chartElement.closest(mobileScrollerSelector).data("kendoMobileScroller");
        },

        destroy: function() {
            this._clearShowTimeout();

            if (this.element) {
                this.element.off(MOUSELEAVE_NS).remove();
                this.element = null;
            }
        },

        setOptions: function(options) {
            this.options = deepExtend({}, this.options, options);
        },

        options: {
            opacity: 1,
            animation: {
                duration: TOOLTIP_ANIMATION_DURATION
            },
            sharedTemplate:
                "<table>" +
                "<th colspan='3'>#= categoryText #</th>" +
                "# for(var i = 0; i < points.length; i++) { #" +
                "# var point = points[i]; #" +
                "<tr>" +
                    "<td><span class='k-chart-shared-tooltip-marker' style='background-color:#:point.series.color#'></span></td>" +
                    "# if(point.series.name) { # " +
                        "<td> #= point.series.name #:</td>" +
                    "# } #" +
                    "<td>#= content(point) #</td>" +
                "</tr>" +
                "# } #" +
                "</table>",
            categoryFormat: "{0:d}"
        },

        move: function() {
            var tooltip = this,
                options = tooltip.options,
                element = tooltip.element,
                offset;

            if (!tooltip.anchor || !tooltip.element) {
                return;
            }

            offset = tooltip._offset();
            if (!tooltip.visible) {
                element.css({ top: offset.top, left: offset.left });
            }

            tooltip.visible = true;
            tooltip._ensureElement(document.body);
            element
                .stop(true, true)
                .show()
                .animate({
                    left: offset.left,
                    top: offset.top
                }, options.animation.duration);
        },

        _clearShowTimeout: function() {
            if (this.showTimeout) {
                clearTimeout(this.showTimeout);
                this.showTimeout = null;
            }
        },

        getAnchor: function(size) {
            var anchor = this.anchor;
            var point = anchor.point;
            var align = anchor.align;
            var x = point.left;
            var y = point.top;
            if (align.horizontal === "center") {
                x -= size.width / 2;
            } else if (align.horizontal === "right") {
                x -= size.width;
            }

            if (align.vertical === "center") {
                y -= size.height / 2;
            } else if (align.vertical === "bottom") {
                y -= size.height;
            }

            return {
                x: x,
                y: y
            };
        },

        _offset: function() {
            var tooltip = this,
                size = tooltip._measure(),
                anchor = tooltip.getAnchor(size),
                top = anchor.y,
                left = anchor.x,
                zoomLevel = kendo.support.zoomLevel(),
                viewport = $(window),
                scrollTop = window.pageYOffset || document.documentElement.scrollTop || 0,
                scrollLeft = window.pageXOffset || document.documentElement.scrollLeft || 0,
                movable = (this._mobileScroller || {}).movable;

            if (!movable || movable.scale === 1) {
                top += tooltip._fit(top - scrollTop, size.height, outerHeight(viewport) / zoomLevel);
                left += tooltip._fit(left - scrollLeft, size.width, outerWidth(viewport) / zoomLevel);
            } else {
                var transform = geom.transform().scale(movable.scale, movable.scale, [movable.x, movable.y]);
                var point = new geom.Point(left, top).transform(transform);
                left = point.x;
                top = point.y;
            }

            return {
                top: top,
                left: left
            };
        },

        show: function(e) {
            this.anchor = e.anchor;
            this.element.css(e.style);
            this.element.toggleClass(TOOLTIP_INVERSE, !!e.className);
            this.element.toggleClass(SHARED_TOOLTIP_CLASS, !!e.shared);

            var content = e.shared ? this._sharedContent(e) : this._pointContent(e.point);
            this.element.html(content);

            this._clearShowTimeout();
            this.showTimeout = setTimeout(this.move, TOOLTIP_SHOW_DELAY);
        },

        hide: function() {
            var tooltip = this;

            clearTimeout(tooltip.showTimeout);
            tooltip._hideElement();

            if (tooltip.visible) {
                tooltip.point = null;
                tooltip.visible = false;
                tooltip.index = null;
            }
        },

        _sharedContent: function(e) {
            var tooltip = this,
                template,
                content;

            template = kendo.template(tooltip.options.sharedTemplate);
            content = template({
                points: e.points,
                category: e.category,
                categoryText: e.categoryText,
                content: tooltip._pointContent
            });

            return content;
        },

        _measure: function() {
            this._ensureElement();

            var size = {
                width: outerWidth(this.element),
                height: outerHeight(this.element)
            };

            return size;
        },

        _ensureElement: function() {
            if (this.element) {
                this.element
                    .appendTo(document.body)
                    .on(MOUSELEAVE_NS, this._mouseleave);
            }
        },

        _mouseleave: function(e) {
            var target = e.relatedTarget;
            var chart = this.chartElement[0];
            if (target && target !== chart && !$.contains(chart, target)) {
                this.trigger(LEAVE);
                this.hide();
            }
        },

        _hideElement: function() {
            var tooltip = this;
            var element = this.element;
            if (element) {
                element.fadeOut({
                    always: function(){
                        if (!tooltip.visible) {
                            element.off(MOUSELEAVE_NS).remove();
                        }
                    }
                });
            }
        },

        _pointContent: function(point) {
            var tooltip = this,
                options = deepExtend({}, tooltip.options, point.options.tooltip),
                content, tooltipTemplate;

            if (defined(point.value)) {
                content = point.value.toString();
            }

            if (options.template) {
                tooltipTemplate = template(options.template);
                content = tooltipTemplate({
                    value: point.value,
                    category: point.category,
                    series: point.series,
                    dataItem: point.dataItem,
                    percentage: point.percentage,
                    runningTotal: point.runningTotal,
                    total: point.total,
                    low: point.low,
                    high: point.high,
                    xLow: point.xLow,
                    xHigh: point.xHigh,
                    yLow: point.yLow,
                    yHigh: point.yHigh
                });
            } else if (options.format) {
                content = point.formatValue(options.format);
            }

            return content;
        },

        _fit: function(offset, size, viewPortSize) {
            var output = 0;

            if (offset + size > viewPortSize) {
                output = viewPortSize - (offset + size);
            }

            if (offset < 0) {
                output = -offset;
            }

            return output;
        }
    });

    var CrosshairTooltip = Tooltip.extend({
        init: function(chartElement, options) {
            Tooltip.fn.init.call(this, chartElement, options);
            this.element.addClass("k-chart-crosshair-tooltip");
        },

        show: function(e) {
            var element = this.element;

            if (element) {
                this.anchor = e.anchor;
                this.element.css(e.style);
                this.element.html(this.content(e));

                this.move();
            }
        },

        move: function() {
            var tooltip = this,
                element = tooltip.element,
                offset = tooltip._offset();

            tooltip._ensureElement();
            element.css({ top: offset.top, left: offset.left }).show();
        },

        content: function(e) {
            var content = e.value,
                options = e.crosshair.options.tooltip;

            if (options.template) {
                content = template(options.template)({
                    value: content
                });
            }

            return content;
        },

        hide: function() {
            this.element.hide();
        }
    });

    var ChartPane = Class.extend({
        init: function(chart, pane) {
            this._chart = chart;
            this._pane = pane;
            this.visual = pane.visual;
            this.chartsVisual = pane.chartContainer.visual;
            this.name = pane.options.name;
        },

        series: function() {
            var chart = this._chart;
            var seriesByPane = chart._plotArea.groupSeriesByPane();
            var series = seriesByPane[this.name || "default"];

            var result = [];
            if (series) {
                for (var idx = 0; idx < series.length; idx++) {
                    result.push(new ChartSeries(chart, series[idx]));
                }
            }

            return result;
        }
    });

    var ChartSeries = Class.extend({
        init: function(chart, options) {
            this._chart = chart;
            this._options = options;
        },

        points: function(filter) {
            var points = this._points;
            if (!points) {
                var series = this._seriesOptions();
                var plotArea = this._chart._plotArea;
                this._points = points = plotArea.pointsBySeriesIndex(series.index);
            }
            if (kendo.isFunction(filter)) {
                points = this._filterPoints(points, filter);
            }


            return points;
        },

        data: function(data) {
            var series = this._seriesOptions();
            if (data) {
                var chart = this._chart;
                var plotArea = chart._plotArea;

                series.data = data;

                if (series.categoryField) {
                    var axis = plotArea.seriesCategoryAxis(series);
                    var options = [].concat(chart.options.categoryAxis);

                    chart._instance._bindCategoryAxisFromSeries(options[axis.axisIndex], axis.axisIndex);
                }

                chart._noTransitionsRedraw();
                this._clearFields();
            }

            return series.data;
        },

        findPoint: function(filter) {
            var points = this.points();
            for (var idx = 0; idx < points.length; idx++) {
                if (filter(points[idx])) {
                    return points[idx];
                }
            }
        },

        toggleHighlight: function(show, elements) {
            if (!elements) {
                elements = this.points();
            } else if (kendo.isFunction(elements)) {
                elements = this.points(elements);
            } else {
                elements = isArray(elements) ? elements : [elements];
            }

            this._chart._instance._togglePointsHighlight(show, elements);
        },

        toggleVisibility: function(visible, filter) {
            var chart = this._chart;
            var seriesOptions = this._seriesOptions();
            var hasFilter = kendo.isFunction(filter);
            if (!hasFilter) {
                seriesOptions.visible = visible;
                chart._saveGroupVisibleState(seriesOptions);
            } else {
                if (inArray(seriesOptions.type, [PIE, DONUT, FUNNEL])) {
                    var data = this._filterData(filter);
                    for (var idx = 0; idx < data.length; idx++) {
                        data[idx].visible = visible;
                    }
                } else {
                    seriesOptions.visible = function(data) {
                        return filter(data.dataItem) ? visible : true;
                    };
                }
            }

            chart._noTransitionsRedraw();

            this._clearFields();
        },

        _filterData: function(filter) {
            var data = this._seriesOptions().data;
            var length = data.length;
            var result = [];

            for (var idx = 0; idx < length; idx++) {
                if (filter(data[idx])) {
                    result.push(data[idx]);
                }
            }
            return result;
        },

        _filterPoints: function(points, filter) {
            var result = [];
            var length = points.length;
            for (var idx = 0; idx < length; idx++) {
                if (filter(points[idx])) {
                    result.push(points[idx]);
                }
            }
            return result;
        },

        _seriesOptions: function() {
            var series = this._series;
            if (!series) {
                series = this._series = this._chart._seriesOptions(this._options);
            }
            return series;
        },

        _clearFields: function() {
            delete this._points;
            delete this._series;
        }
    });

    dataviz.Tooltip = Tooltip;
    dataviz.CrosshairTooltip = CrosshairTooltip;
    dataviz.ChartInstanceObserver = ChartInstanceObserver;
    dataviz.ChartPane = ChartPane;
    dataviz.ChartSeries = ChartSeries;

})(window.kendo.jQuery);

return window.kendo;

}, typeof define == 'function' && define.amd ? define : function(a1, a2, a3){ (a3 || a2)(); });
