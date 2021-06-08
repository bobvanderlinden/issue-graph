"use strict";
exports.handler = (event, context, callback) => {
  const request = event.Records[0].cf.request;
  const response = event.Records[0].cf.response;

  const origin = request?.headers?.origin?.[0]?.value;
  console.log(request?.uri, response?.status);
  if (response) {
    response.headers["access-control-allow-origin"] = [
      { key: "Access-Control-Allow-Origin", value: origin || "*" },
    ];
    response.headers["hallo"] = [{ key: "Hallo", value: "aaa" }];
    callback(null, response);
  } else if (request) {
    if (request.method === "OPTIONS") {
      const response = {
        status: "204",
        headers: {
          "access-control-allow-origin": [
            { key: "Access-Control-Allow-Origin", value: origin || "*" },
          ],
          "access-control-allow-headers": [
            { key: "Access-Control-Allow-Headers", value: "Content-Type" },
          ],
          "access-control-allow-methods": [
            {
              key: "Access-Control-Allow-Methods",
              value: "GET, HEAD, PUT, POST, DELETE, PATCH",
            },
          ],
          "access-control-allow-credentials": [
            { key: "Access-Control-Allow-Credentials", value: "true" },
          ],
          "access-control-max-age": [
            { key: "Access-Control-Max-Age", value: "8640000" },
          ],
        },
      };
      callback(null, response);
    } else {
      callback(null, request);
    }
  }
};
