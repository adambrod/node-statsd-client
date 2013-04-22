/*
 * Return express middleware that measures overall performance.
 *
 * The `prefix` defaults to `''` (but is currently mandatory). The
 * `options`-argument is optional.
 *  * You can set `timeByUrl`, that add a timer per URL template (ex:
 *    `/api/:username/:thingie`). This can be changed run-time by setting
 *    `res.locals.statsdUrlKey`.
 *  * You can set `countByUrl` and `statusCodeByUrl` to track the counts and status codes per url.
 *  * Add a `function(client, startTime, req, res)` in `onResponseEnd` that
 *    will be called at the very end.
 */
function factory(parentClient) {
    return function (prefix, options) {
        var client = parentClient.getChildClient(prefix || '');
        options = options || {};
        var timeByUrl = options.timeByUrl || false;
        var countByUrl = options.countByUrl || false;
        var statusCodeByUrl = options.statusCodeByUrl || false;
        var trackByUrl = timeByUrl || countByUrl || statusCodeByUrl;
        var onResponseEnd = options.onResponseEnd;

        return function (req, res, next) {
            var startTime = new Date();

            // Shadow end request
            var end = res.end;
            res.end = function () {
                end.apply(res, arguments);

                client.increment('response_code.' + res.statusCode);

                // Time by URL?
                if (trackByUrl) {
                    var routeName = "unknown_express_route";

                    // Did we get a harc-coded name, or should we figure one out?
                    if (res.locals && res.locals.statsdUrlKey) {
                        routeName = res.locals.statsdUrlKey;
                    } else if (req.route && req.route.path) {
                        routeName = req.route.path;
                        if (Object.prototype.toString.call(routeName) === '[object RegExp]') {
                            // Might want to do some sanitation here?
                            routeName = routeName.source;
                        }
                        if (routeName === "/") routeName = "root";
                        routeName = req.method + '_' + routeName;
                    }

                    // Get rid of : in route names, remove first /, and replace
                    // rest with _.
                    routeName = routeName.replace(/:/g, "").replace(/\//, "").replace(/\//g, "_"),
                    if (timeByUrl) {
                        client.timing('response_time.' + routeName, startTime);
                    }
                    if (countByUrl) {
                        client.increment(routeName);
                    }
                    if (statusCodeByUrl) {
                        client.increment('response_code.'+routeName+'.'+res.statusCode);
                    }
                } else {
                    client.timing('response_time', startTime);
                }

                if (onResponseEnd) {
                    onResponseEnd(client, startTime, req, res);
                }
            };
            next();
        };
    };
}

module.exports = factory;
