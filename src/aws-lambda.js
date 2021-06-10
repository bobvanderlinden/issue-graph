"use strict";

function handleViewerRequest({ request }) {
  if (request.method !== "OPTIONS") {
    return request;
  }
  const origin = request?.headers?.origin?.[0]?.value;
  console.log("Origin", origin);
  return {
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
}

function handleOriginRequest({ request }) {
  request.headers.host = [{ key: "Host", value: "github.com" }];
  request.headers.authority = [{ key: "Authority", value: "github.com" }];
  return request;
}

function handleViewerResponse({ request, response }) {
  const origin = request?.headers?.origin?.[0]?.value;
  console.log("Origin", origin);
  response.headers["access-control-allow-origin"] = [
    { key: "Access-Control-Allow-Origin", value: origin || "*" },
  ];
  return response;
}

function handleEvent(cf) {
  const eventType = cf.config.eventType;
  console.log("EventType", eventType);
  switch (eventType) {
    case "viewer-request":
      return handleViewerRequest(cf);
    case "origin-request":
      return handleOriginRequest(cf);
    case "viewer-response":
      return handleViewerResponse(cf);
    default:
      throw new Error("Unsupported event type: " + eventType);
  }
}

exports.handler = (event, context, callback) => {
  const cf = event.Records[0].cf;

  const result = handleEvent(cf);
  callback(null, result);
};
