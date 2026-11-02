// Nadomestek za Leaflet/Leaflet.draw/QRCode v testih (v tem okolju CDN-ji niso dosegljivi).
// Preizkusi logiko aplikacije in razkrije napake v JS; NE preizkuša dejanskega izrisa zemljevida.
(function () {
    'use strict';
    window.__L = { markers: [], circles: [], polylines: [], popupOpens: [] };

    function globokProxy() {
        return new Proxy(function () {}, {
            get: (t, p) => (p in t) ? t[p] : (t[p] = globokProxy()),
            set: (t, p, v) => { t[p] = v; return true; },
            apply: () => globokProxy()
        });
    }

    function ustvari(razred, args, vrsta) {
        const zadnji = args[args.length - 1];
        const self = {
            vrsta: vrsta, args: args, sloji: new Set(), handlers: {}, tooltip: null, popup: null,
            options: (zadnji && typeof zadnji === 'object' && !Array.isArray(zadnji) && !(zadnji.lat !== undefined)) ? Object.assign({}, zadnji) : {},
            latlng: Array.isArray(args[0]) ? args[0].slice() : (args[0] && args[0].lat !== undefined ? [args[0].lat, args[0].lng] : null),
            radius: (zadnji && zadnji.radius) || 0, opacity: 1, popupOdprt: false
        };
        if (razred) Object.setPrototypeOf(self, razred.prototype);
        let proxy;
        const metode = {
            addLayer: (l) => { self.sloji.add(l); return proxy; },
            removeLayer: (l) => { self.sloji.delete(l); return proxy; },
            hasLayer: (l) => self.sloji.has(l),
            clearLayers: () => { self.sloji.clear(); return proxy; },
            eachLayer: (f) => { Array.from(self.sloji).forEach(f); return proxy; },
            getLayers: () => Array.from(self.sloji),
            addTo: (cilj) => { if (cilj && cilj.addLayer) cilj.addLayer(proxy); return proxy; },
            getLatLng: () => ({ lat: self.latlng[0], lng: self.latlng[1], distanceTo: () => 0 }),
            setLatLng: (ll) => { self.latlng = Array.isArray(ll) ? ll.slice() : [ll.lat, ll.lng]; return proxy; },
            setLatLngs: () => proxy,
            getRadius: () => self.radius,
            setRadius: (r) => { self.radius = r; return proxy; },
            setOpacity: (o) => { self.opacity = o; return proxy; },
            setIcon: (i) => { self.options.icon = i; return proxy; },
            setStyle: (s) => { Object.assign(self.options, s || {}); return proxy; },
            on: (ev, f) => { (self.handlers[ev] = self.handlers[ev] || []).push(f); return proxy; },
            off: () => proxy,
            bindTooltip: (c, o) => { self.tooltip = { content: c, options: o }; return proxy; },
            setTooltipContent: (c) => { if (self.tooltip) self.tooltip.content = c; return proxy; },
            getTooltip: () => self.tooltip,
            unbindTooltip: () => { self.tooltip = null; return proxy; },
            bindPopup: (c) => { self.popup = { content: c }; return proxy; },
            setPopupContent: (c) => { if (self.popup) self.popup.content = c; return proxy; },
            openPopup: () => {
                self.popupOdprt = true;
                document.querySelectorAll('.stub-popup').forEach(n => n.remove());
                const el = document.createElement('div');
                el.className = 'stub-popup';
                document.body.appendChild(el);
                const vsebina = self.popup ? (typeof self.popup.content === 'function' ? self.popup.content() : self.popup.content) : '';
                el.innerHTML = vsebina;
                window.__L.popupOpens.push({ vsebina: vsebina });
                (self.handlers.popupopen || []).forEach(f => f({ popup: { getElement: () => el } }));
                return proxy;
            },
            isPopupOpen: () => self.popupOdprt,
            getBounds: () => { const b = { extend: () => b }; return b; },
            toGeoJSON: () => ({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [self.latlng[1], self.latlng[0]] } }),
            flyTo: () => proxy, setView: () => proxy, fitBounds: () => proxy, invalidateSize: () => proxy,
            getCenter: () => ({ lat: 46.39, lng: 15.57 }),
            getContainer: () => (self.vsebnik = self.vsebnik || document.createElement('div')),
            addControl: () => proxy, removeControl: () => proxy
        };
        proxy = new Proxy(self, {
            get: (t, p) => {
                if (p in metode) return metode[p];
                if (p in t) return t[p];
                if (typeof p === 'string') return (...a) => proxy;
                return undefined;
            }
        });
        return proxy;
    }

    function razred(ime) { const f = function () {}; Object.defineProperty(f, 'name', { value: ime }); return f; }
    const Marker = razred('Marker'), Circle = razred('Circle'), Polygon = razred('Polygon'), Polyline = razred('Polyline'), Rectangle = razred('Rectangle');
    Rectangle.prototype = Object.create(Polygon.prototype); Polygon.prototype = Object.create(Polyline.prototype);

    const FeatureGroup = function () { return ustvari(null, [], 'FeatureGroup'); };
    const L = {
        Marker: Marker, Circle: Circle, Polygon: Polygon, Polyline: Polyline, Rectangle: Rectangle, FeatureGroup: FeatureGroup,
        LayerGroup: FeatureGroup,
        map: function () { const m = ustvari(null, arguments, 'Map'); window.__L.map = m; return m; },
        tileLayer: function () { return ustvari(null, arguments, 'TileLayer'); },
        marker: function () { const m = ustvari(Marker, arguments, 'Marker'); window.__L.markers.push(m); return m; },
        circle: function () { const c = ustvari(Circle, arguments, 'Circle'); window.__L.circles.push(c); return c; },
        circleMarker: function () { const c = ustvari(Marker, arguments, 'CircleMarker'); return c; },
        polyline: function () { const p = ustvari(Polyline, arguments, 'Polyline'); window.__L.polylines.push(p); return p; },
        featureGroup: function () { return ustvari(null, [], 'FeatureGroup'); },
        layerGroup: function () { return ustvari(null, [], 'LayerGroup'); },
        divIcon: function (o) { return o; },
        latLng: function (a, b) { return { lat: a, lng: b, distanceTo: () => 0 }; },
        geoJSON: function (g) { const o = ustvari(null, [g], 'GeoJSON'); o.getLayers = () => [ustvari(Polygon, [], 'Polygon')]; return o; },
        control: { layers: function () { return ustvari(null, [], 'Layers'); } },
        Control: {
            extend: function (proto) {
                const K = function () { return Object.create(proto); };
                return K;
            }
        },
        DomUtil: { create: (tag) => document.createElement(tag === 'a' ? 'a' : tag === 'select' ? 'select' : 'div') },
        DomEvent: { disableClickPropagation: () => {}, on: () => {}, stop: () => {} },
        drawLocal: globokProxy(),
        Draw: { Event: { CREATED: 'draw:created', DRAWSTART: 'draw:drawstart', DRAWSTOP: 'draw:drawstop' } }
    };
    L.Control.Draw = function () { return ustvari(null, [], 'Draw'); };
    window.L = L;
    window.QRCode = function () {}; window.QRCode.CorrectLevel = { H: 1 };
})();
