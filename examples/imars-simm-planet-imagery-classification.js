/*                                        

Mapping seagrass in Ten Thousand Island - Florida USA

Authors: 
  Ana Carolina Peralta (IMaRS USF)
  .
  .
  .
  TBD
  
Quick tips:
Ctrl + Space after ( for help with any command
Ctrl + f to search
Ctrl + h to replace
*/

//=====================================================================================================================//
// === setup
//=====================================================================================================================//
// === Define area of interest (AOI)
// Using imported shapefile from Assests: TenThousandIslands_footprint
// Then add it to the map
Map.addLayer(AOI, {},'AOI', false, 0.7);

// === Select the basemap you would like to use
// Basemap options: "ROADMAP", "SATELLITE", "HYBRID" or "TERRAIN"
Map.setOptions('Satellite');

// === Prepare input imagery
// PlanetScope imported from assets above.

// === Composite
// Rather than creating an image composite of all the sections,
// (ie stiching the sections together before running the classification) 
// we work the images individualy and after create the composite.

// === Import IMaRS' Regional and Satellite-specific helper functions
var ROI = require("users/tylarmurray/rois:TTI");
var sat_fns = require('users/tylarmurray/sat_fns:planet_fns');

// Define True Color Visualization Parameters
var visParams = {
  bands: ['b6', 'b3', 'b2'],  // RGB bands
  min: 0,
  max: 3000,
  gamma: 1.4
};

//=====================================================================================================================//
// === Load and PreProcess the Image
//=====================================================================================================================//
// === Get metadata and number of images in the collection
//var collection = ee.ImageCollection('projects/imars-simm/assets/planet_tti')
//print(collection)

// === List all image IDs in the collection
//var imageIds = collection.aggregate_array('system:index');
//print('Image IDs:', imageIds);

/////IMAGES FOR TTI 2023////
//var TTI = ee.Image ('projects/imars-simm/assets/planet_tti/20231023_155324_72_2479') // south; good and clean image
//var TTI = ee.Image('projects/imars-simm/assets/planet_tti/20230923_155247_60_248e') //all AOI; good
//var TTI = ee.Image('projects/imars-simm/assets/planet_tti/20231004_155144_73_247f') //takes almost all AOI; a lot of clouds; somehow useful 
//var TTI = ee.Image('projects/imars-simm/assets/planet_tti/20231101_155514_93_247a') //north; good
//var TTI = ee.Image('projects/imars-simm/assets/planet_tti/20230923_155245_46_248e') //north; good
var TTI = ee.Image('projects/imars-simm/assets/planet_tti/20230923_155103_51_2490') //north; good

// === Rescale the image
// divide each band by 10000 to convert SR values between 0 and 
var TTI = sat_fns.rescale(TTI);
// alternative:
// var TTIdivide = TTI.divide(10000)

print('TTI Metadata:', TTI);

// === ADD MASKS
// cloud mask, water/land mask, sun-glint, Depth Invariant Index

// Add Cloud Mask
var img = sat_fns.cloudMask(TTI, ROI);

// Print to check if masking was successful
print('Masked Image:', img);

// Visualize the rescaled image
Map.centerObject(img, 10);
Map.addLayer(
  img.clip (AOI), 
  {
    bands: ['b6', 'b3', 'b2'], 
    min: 0, 
    max: 0.14
    
  }, 
  'Rescaled clipped Image'
);

// === Water Mask, calculate NDWI (using Green 'b3 or b4' and NIR 'b8') for water detection
var img = sat_fns.landMaskNDWI(img);
// Print masked image for verification
print('Masked Image with NDWI:', img);

// Add to the map
//Map.addLayer(ndwi, {min: -1, max: 1, palette: ['brown', 'blue']}, 'NDWI');
Map.addLayer(img, visParams, 'Water Masked Image');

// === Apply sun-glint correction
img = sat_fns.deGlint(img, sunglint);

print('deglintedImage',img)
Map.addLayer(
  img, 
  {
    bands: [
      'Red_deglinted', 
      'Green_deglinted', 
      'Blue_deglinted'
    ], 
    min: 0, 
    max: 0.2, 
    gamma: 2
  }, 
  'Deglinted Image'
);

Map.centerObject(sunglint, 10);  // Center on the sunglint region
var img_masked = img; 


// === Apply Depth Invariant Index - DII
img = sat_fns.addDII(img);

// Compute vegetation indices for each image

// Select bands
var nir = finalImage.select('b8'); //img_rescale.select
var green = finalImage.select('b3'); 
var red = finalImage.select('b6');
var blue = finalImage.select('b1');

// NDVIw
//var ndviw = nir.subtract(green).divide(nir.add(green)).rename('NDVIw');
// SVI Simple Vegetation Index - Typically range from 0 to 3, (~>1): Indicate areas with healthy vegetation
//var svi = green.divide(red).rename('SVI');
// AVI Aquatic Vegetation Index
  //var avi = green.subtract(blue).divide(green.add(blue)).rename('AVI');

// Add bands to the image
//Map.centerObject(TTI, 12);
//Map.addLayer(ndviw, {min: -1, max: 1, palette: ['blue', 'white', 'green']}, 'NDVIw'); //The NDVIw values will range between -1 and 1:Positive values (~0.1 to 1): Likely vegetation.Values near 0: Possibly water or sparse vegetation. Negative values: Likely water or other non-vegetative surfaces.
//Map.addLayer(svi, {min: 0, max: 3, palette: ['blue', 'white', 'green']}, 'SVI');
//Map.addLayer(avi, {min: -1, max: 1, palette: ['blue', 'white', 'green']}, 'AVI'); //values will range between -1 and 1:Positive values (~0.1 to 1): Likely vegetation.Values near 0: Possibly water or sparse vegetation. Negative values: Likely water or other non-vegetative surfaces.

//The indices values can get better after applying the DII and playing with better sand_poly areas.

//=====================================================================================================================//
// === Prepare training and testing data 
//=====================================================================================================================//
//Add input for training of the SVM classification algorithm
//blue, green and red bands, the coastal aerosol - if available and the DII band (The output of the blue and green band ratios). The use of 
//the spectral bands along with the DII is intended to increase multidimensionality and classification accuracy of SVM, 
//as described by Zhang et al. (2006), and to compensate for the effect of shallow water column on bottom reflectance.

//  - Draw one set of points over a few sample of hard bottom areas, try to capture some variability
//    - Convert the points geometries to a Feature Collection and change label to "HardBottom"  
//    - Add a "cover" property and apply a value of 1 to this HardBottom collection
//  - Draw another set of points over macroalgae areas, try to capture the variability.
//    - Convert the points geometries to a Feature Collection and change label to "subaquaveg=sav" 
//    - Add a "cover" property and apply a value of 2 to this "sav" collection
/// - Draw another set of points over mud, oyster, sand and shells areas, try to capture the variability.
//    - Add a "cover" property and apply a value of 0, 3, 4, 5 to these collections

//////Classes for TTI are:

///HardBottom, subaquaveg (macroalgae), mud, oyster, sand, shell. The field data also applies the classes as "HabitatType": soft bottom, Macroalgae-softbottom, hard bottom, Macroalgae-hardbottom, macroalgae, Macroalgae-mud, oyster bed, Softbottom-shell, mud-shell
///The spatial resolution of the images doesent allow us to separate all these features, therefore we will merge as follow: 
///softbottom=>mud + sand + shell:0
///gravel=>Hard Bottom + macroalgae + shell + oyster:1
///sav=>macroalgae + sand:2
///oyster=> oyster beds or ouster patches alone: 3
///water=> water canals: 4

//  Merge the featureCollections together
var classNames = softbottom.merge(gravel).merge(sav).merge(oyster).merge(water); //IS THERE AN ORDER FOR MERGING?

//  Define the bands you want to include in the model
var bands = ['b1','b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8','b2b3','Blue_deglinted','Green_deglinted','Red_deglinted',] // Why this bands? check criteria for selcting the bands.

//  Create a variable called bandsimage to select the bands of interest and clip to the AOI
var bandsimage = finalImage.select(bands).clip(AOI) 

// Data verification check: to make sure my classes and bands are correct
print('Merged Training Data:', classNames) // verify that the merged classNames variable contains features with valid geometries and attributes. Ensure they all have a class property (0, 1, 2)
//Map.addLayer(classNames, {}, 'Training Data'); //to visualize your sample locations points
print('Available bands:', finalImage.bandNames())

//  Create cover samples and band values at the sample locations
var samples = bandsimage.sampleRegions({
  collection: classNames, // Extract sample locations from the classes polygons
  properties: ['cover'], // Label to retain from each sample
  scale: 3
})   // Make each sample the same size as Planet pixel
.randomColumn('random'); // Create a column with random numbers //
  
// Parse sample classes
var softbottomClass = samples.filter(ee.Filter.eq('cover',0)) //mud + sand + shell
var gravelClass = samples.filter(ee.Filter.eq('cover',1)) //Hard Bottom + macroalgae + shell + oyster
var savClass = samples.filter(ee.Filter.eq('cover',2)) //macroalgae + sand
var oysterClass = samples.filter(ee.Filter.eq('cover',3)) //oyster beds alone
var waterClass = samples.filter(ee.Filter.eq('cover',4)) //water canals

// Generate random numbers from 0 to 1 for each sampled class.
var softbottomRandom = softbottomClass.randomColumn("random");
var gravelRandom = gravelClass.randomColumn("random");
var savRandom = savClass.randomColumn("random");
var oysterRandom = oysterClass.randomColumn("random");
var waterRandom = waterClass.randomColumn("random");

// Merge classes again
var groundData = softbottomRandom.merge(gravelRandom).merge(savRandom).merge(oysterRandom).merge(waterRandom);
print('Survey Data:',groundData)

// Split ground data in training (~70%) and validation (~30%) points (only to show on map)
var trainingPoints = groundData.filter(ee.Filter.lt("random",0.7));
var validationPoints = groundData.filter(ee.Filter.gte("random", 0.3));

//=====================================================================================================================//
// === Define and train the classifier 
//=====================================================================================================================//
var SVM = ee.Classifier.libsvm({
  kernelType: 'RBF',
  gamma: 90, 
  cost: 100 
});
var trainSVM = SVM.train({
  features: trainingPoints,
  classProperty: 'cover',
  inputProperties: bands
});

//=====================================================================================================================//
// === Classify the image using the trained classifier
//=====================================================================================================================//
var classifiedSVM = finalImage.classify(trainSVM);

// === Display Classification Map and Accuracy Assessment
// Define a palette for the distinct classes 
// Recommended to use https://colorbrewer2.org/ to select color palettes//
var spectral =['#fbb4ae','#377eb8','#4daf4a','#984ea3','#ff7f00']
var classPalette = {min:0, max:4, palette:spectral} 

//To confirm which class is which color, print the classification map legend:
//var classNames = ['softbottom', 'gravel', 'sav', 'oyster', 'water',]; 

//for (var i = 0; i < spectral.length; i++) {
 // print(classNames[i] + ': ' + spectral[i]);
//}

//softbottom: #fbb4ae pink
//hardbottom: #377eb8 blue
//sav: #4daf4a green
//oysterbed: #984ea3 purple 
//deepwater: #ff7f00 orange


// === Display Classified map
Map.addLayer(classifiedSVM, classPalette, 'SVM classification',false);

//To show single classes (SVM):
var classifiedSVMsav = classifiedSVM.eq(2)
Map.addLayer(classifiedSVM.mask(classifiedSVMsav), {palette: ['#91af40']}, 'SVM SAV', false);
var classifiedSVMgravel = classifiedSVM.eq(1)
Map.addLayer(classifiedSVM.mask(classifiedSVMgravel), {palette:['#e66101']}, 'SVM gravel', false);
var classifiedSVMsoftbottom = classifiedSVM.eq(0)
Map.addLayer(classifiedSVM.mask(classifiedSVMsoftbottom), {palette:['#dfc27d']}, 'SVM softbottom', false);
var classifiedSVMoyster = classifiedSVM.eq(3)
Map.addLayer(classifiedSVM.mask(classifiedSVMoyster), {palette:['#7b3294']}, 'SVM oyster', false);

// === Calculate accuracy using validation data
// Classify the image using the trained classifier
var validationSVM = validationPoints.classify(trainSVM);

// Get a confusion matrix representing expected accuracy (Using validation points - 30%)
var errorMatrixSVM = validationSVM.errorMatrix('cover', 'classification');
print('SVM Confussion Matrix', errorMatrixSVM);

// Get a confusion matrix representing resubstitution accuracy.
// Axis 0 of the matrix correspond to the input classes, and axis 1 to the output classes.
print('Validation overall accuracy: ', errorMatrixSVM.accuracy());

// Estimate user and producer accuracies
var producerAccuracySVM = errorMatrixSVM.producersAccuracy()
var userAccuracySVM = errorMatrixSVM.consumersAccuracy()

print('Producer Accuracy SVM: ',producerAccuracySVM)
print('User Accuracy SVM: ',userAccuracySVM)

// The Kappa Coefficient is generated from a statistical test to evaluate the accuracy 
// of a classification. Kappa essentially evaluate how well the classification performed 
// as compared to just randomly assigning values, i.e. did the classification do better 
// than random. The Kappa Coefficient can range from -1 t0 1. A value of 0 indicated that 
// the classification is no better than a random classification. A negative number 
// indicates the classification is significantly worse than random. A value close to 1 
// indicates that the classification is significantly better than random.
var kappaSVM = errorMatrixSVM.kappa()
print('Kappa Statistic: ', kappaSVM)
print (trainSVM.explain())

/*
/////To add a legend on the map//////

var legend = ui.Panel({style: {position: 'bottom-left', padding: '8px'}});

var title = ui.Label('Classification Legend', {fontWeight: 'bold', fontSize: '14px'});
legend.add(title);

for (var i = 0; i < spectral.length; i++) {
  var colorBox = ui.Label({
    style: {backgroundColor: spectral[i], padding: '8px', margin: '4px'}
  });
  var classLabel = ui.Label(classNames[i]);
  
  var legendRow = ui.Panel([colorBox, classLabel], ui.Panel.Layout.Flow('horizontal'));
  legend.add(legendRow);
}

Map.add(legend);
*/

