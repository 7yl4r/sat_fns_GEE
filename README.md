# sat_fns_GEE
sat_fns is a set of functions to make data from multiple satellites seamless

## [GEE repo tylarmurray/sat_fns](https://code.earthengine.google.com/?accept_repo=users/tylarmurray/sat_fns)

```js
// sat_fns GEE scripts are modules meant to be imported into other scripts.
//
// Examples of how to use it from another script:
var s2_fns = require(  // import the module
  'users/tylarmurray/sat_fns:s2_fns'
);
image = s2_fns.landMask(image)

// or, for an ee.ImageCollection:
imageCollection = imageCollection.map(s2_fns.landMask);
``
