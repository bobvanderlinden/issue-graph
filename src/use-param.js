const { useState, useEffect } = require("react");
const QueryParams = require("./query-params");

function useParam(name) {
  const [value, setValue] = useState(QueryParams.get(name));

  useEffect(() => {
    function onChange() {
      setValue(QueryParams.get(name));
    }

    QueryParams.addEventListener("change", onChange);

    return () => {
      QueryParams.removeEventListener("change", onChange);
    };
  }, []);

  function setParam(value) {
    QueryParams.set(name, value);
  }

  return [value, setParam];
}

module.exports = {
  useParam,
};
