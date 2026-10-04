/**
 * Server-side Cursor-on-Target (CoT) Gateway Plugin
 * Exposes /api/cot/events, /api/cot/inject, and /api/cot/injected
 */

/** @type {Array<object>} Store for external CoT events injected into Helios C2 */
const injectedCotEvents = [];
const MAX_INJECTED_EVENTS = 200;

export function cotProxy() {
  return {
    name: 'cot-proxy',
    configureServer(server) {
      server.middlewares.use('/api/cot', (req, res, next) => {
        const url = req.url || '';

        // GET /api/cot/events
        if (
          req.method === 'GET' &&
          (url === '/events' || url.startsWith('/events?'))
        ) {
          res.setHeader('Content-Type', 'application/xml; charset=utf-8');
          res.setHeader('Access-Control-Allow-Origin', '*');
          const now = new Date().toISOString();
          const stale = new Date(Date.now() + 10 * 60 * 1000).toISOString();

          // Generate sample tactical CoT feed
          const xmlEvents = injectedCotEvents
            .map((e) => e.rawXml || '')
            .filter(Boolean)
            .join('\n');
          const responseXml = `<?xml version="1.0" standalone="yes"?>\n<events>\n${xmlEvents}\n</events>`;
          res.end(responseXml);
          return;
        }

        // GET /api/cot/injected
        if (
          req.method === 'GET' &&
          (url === '/injected' || url.startsWith('/injected?'))
        ) {
          res.setHeader('Content-Type', 'application/json; charset=utf-8');
          res.setHeader('Access-Control-Allow-Origin', '*');
          res.end(
            JSON.stringify({
              status: 'ok',
              count: injectedCotEvents.length,
              events: injectedCotEvents,
            }),
          );
          return;
        }

        // POST /api/cot/inject
        if (
          req.method === 'POST' &&
          (url === '/inject' || url.startsWith('/inject?'))
        ) {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
            if (body.length > 1e6) {
              // 1MB limit
              req.destroy();
            }
          });
          req.on('end', () => {
            try {
              let parsedEvent;
              if (body.trim().startsWith('<')) {
                // XML format
                const uidMatch = body.match(/uid=["']([^"']+)["']/);
                const typeMatch = body.match(/type=["']([^"']+)["']/);
                const latMatch = body.match(/lat=["']([^"']+)["']/);
                const lonMatch = body.match(/lon=["']([^"']+)["']/);
                const callsignMatch = body.match(/callsign=["']([^"']+)["']/);

                parsedEvent = {
                  uid: uidMatch ? uidMatch[1] : `cot-${Date.now()}`,
                  type: typeMatch ? typeMatch[1] : 'a-f-G',
                  lat: latMatch ? parseFloat(latMatch[1]) : 0,
                  lon: lonMatch ? parseFloat(lonMatch[1]) : 0,
                  callsign: callsignMatch ? callsignMatch[1] : 'INJECTED-TAK',
                  rawXml: body,
                  receivedAt: new Date().toISOString(),
                };
              } else {
                // JSON format
                parsedEvent = JSON.parse(body);
                parsedEvent.receivedAt = new Date().toISOString();
              }

              if (injectedCotEvents.length >= MAX_INJECTED_EVENTS) {
                injectedCotEvents.shift();
              }
              injectedCotEvents.push(parsedEvent);

              res.setHeader('Content-Type', 'application/json');
              res.setHeader('Access-Control-Allow-Origin', '*');
              res.end(
                JSON.stringify({ status: 'success', uid: parsedEvent.uid }),
              );
            } catch (err) {
              res.statusCode = 400;
              res.end(JSON.stringify({ error: 'Malformed CoT payload' }));
            }
          });
          return;
        }

        next();
      });
    },
  };
}
