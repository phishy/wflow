function removeProps(obj, keys) {
  if (obj instanceof Array) {
    obj.forEach(function(item) {
      removeProps(item, keys);
    });
  } else if (typeof obj === "object") {
    Object.getOwnPropertyNames(obj).forEach(function(key) {
      if (keys.indexOf(key) !== -1) delete obj[key];
      else removeProps(obj[key], keys);
    });
  }
}

module.exports = removeProps;
