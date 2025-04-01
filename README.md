# sat_fns_GEE
Google Earth Engine Module for Unified Satellite Mapping

## [GEE repo tylarmurray/sat_fns](https://code.earthengine.google.com/?accept_repo=users/tylarmurray/sat_fns)

```js
// sat_fns GEE scripts are modules meant to be imported into other scripts.
//
// Examples of how to use it from another script:
var sat_fns = require(  // import the module
  'users/tylarmurray/sat_fns:s2_fns'
);
image = sat_fns.landMask(image)

// or, for an ee.ImageCollection:
imageCollection = imageCollection.map(sat_fns.landMask);
```

## citation
TODO: publish somewhere & get a doi

T. Murray, "Google Earth Engine Module for Unified Satellite Mapping," on GitHub, 2025. url: https://github.com/7yl4r/sat_fns_GEE. 
