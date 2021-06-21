class ParamService extends EventTarget {
  getUrl() {
    return new URL(window.location.href);
  }

  getSearchParams() {
    return this.getUrl().searchParams;
  }

  get(name) {
    return this.getSearchParams().get(name);
  }

  getAll(names) {
    const searchParams = this.getSearchParams();
    return names.map((name) => searchParams.get(name));
  }

  merge(params) {
    const url = this.getUrl();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, value);
      }
    }
    console.log(url.toString(), params);
    window.history.replaceState({}, document.title, url.toString());
    this.dispatchEvent(new Event("change"));
  }

  set(name, value) {
    this.merge({ [name]: value });
  }

  delete(name) {
    this.set(name, null);
  }
}

module.exports = new ParamService();
