///////To get a set of image collection features (imageID)///////// 
//=====================================================================================================================//
/*                                        

Mapping seagrass in Ten Thousand Island - Florida USA

Authors: 
  Ana Carolina Peralta (IMaRS USF)
  .
  .
  .
  TBD
  
Quick tips:
Cntl + Space after ( for help with any command
Cntl + f to search
Cntl + h to replace

*/

//////START///////
ee.String('Part A: Define your area of interest & set up the map')

//  Define your area of interest (AOI)
//Import shapefile from to Assests: TenThousandIslands_footprint

Map.addLayer(AOI, {},'AOI', false, 0.7);

//  Select the basemap you would like to use
//  Basemap options: "ROADMAP", "SATELLITE", "HYBRID" or "TERRAIN"
Map.setOptions('Satellite');

//=====================================================================================================================//
ee.String('Part B: Prepare your input imagery - PlanteScope')

//We may need to create an image composite of all the sections: stich the sections together before running the classification? 
//NO. We will work the images individualyy and aafter create the composite

// Import necessary packages 
var ROI = require("users/tylarmurray/rois:TTI");
var sat_fns = require('users/tylarmurray/sat_fns:planet_fns');

// Load and Rescale the Image

//Get metadata and number of images in the collection
//var collection = ee.ImageCollection('projects/imars-simm/assets/planet_tti')
//print(collection)

//List all image IDs in the collection
//var imageIds = collection.aggregate_array('system:index');
//print('Image IDs:', imageIds);

/////IMAGES FOR TTI 2023////


//var TTI= ee.Image ('projects/imars-simm/assets/planet_tti/20231023_155324_72_2479') // south; good and clean image
//var TTI = ee.Image('projects/imars-simm/assets/planet_tti/20230923_155247_60_248e') //all AOI; good
//var TTI = ee.Image('projects/imars-simm/assets/planet_tti/20231004_155144_73_247f') //takes almost all AOI; a lot of clouds; somehow useful 
//var TTI = ee.Image('projects/imars-simm/assets/planet_tti/20231101_155514_93_247a') //north; good
//var TTI = ee.Image('projects/imars-simm/assets/planet_tti/20230923_155245_46_248e') //north; good
var TTI = ee.Image('projects/imars-simm/assets/planet_tti/20230923_155103_51_2490') //north; good

//Rescale the image: we need to divide each band by 10000 to convert SR values between 0 and 
//var TTIdivide = TTI.divide(10000) /// no need to do this now as the rescale calculation is inside the sat_fns

var TTI = sat_fns.rescale(TTI);

print('TTI Metadata:', TTI);

//ADD MASKS: cloud mask, water/land mask, sun-glint, Depth Invariant Index

// Add Cloud Mask
var img = sat_fns.cloudMask(TTI, ROI);

// Print to check if masking was successful
print('Masked Image:', img);

//Visualize the rescaled image
Map.centerObject(TTI, 10);
Map.addLayer(img.clip (AOI), {bands: ['b6', 'b3', 'b2'], min: 0, max: 0.14}, 'Rescaled clipped Image');


// Water Mask, calculate NDWI (using Green 'b3 or b4' and NIR 'b8') for water detection-----------------------------------

// Compute NDWI
var ndwi = img.normalizedDifference(['b4', 'b8']).rename('NDWI'); 
// Clip the origina image
var img_clip = img.clip(AOI)
// Clip NDWI
var ndwi_clipped = ndwi.clip(AOI)
// Add the NDWI band to the original image
var imageWithNDWI = img_clip.addBands(ndwi_clipped);
// Print the result to check
print(imageWithNDWI);


// Threshold NDWI to identify water (e.g., NDWI > 0)
var waterMaskNDWI = ndwi_clipped.gt(-0.1);// before 0
// Apply the water mask to the image
var waterMaskedImageNDWI = imageWithNDWI.updateMask(waterMaskNDWI);
// Print masked image for verification
print('Masked Image with NDWI:', waterMaskedImageNDWI); // 

// Define visualization parameters
var visParams = {
 bands: ['b6', 'b3', 'b2'],  // RGB bands
 min: 0,
 max: 3000,
gamma: 1.4
};



// Add to the map
//Map.addLayer(ndwi, {min: -1, max: 1, palette: ['brown', 'blue']}, 'NDWI');
//Map.addLayer(waterMaskedImageNDWI, visParams, 'NDWI Water Masked Image');

// Apply sun-glint correction --------------------------------------------------------------------------------------------- 

// Load your image with NIR and visible bands
var image = waterMaskedImageNDWI; //it has the cloud mask, water mask and is clipped to the AOI

// Select the bands
var NIR = image.select('b8');  // Adjust 'NIR' to the actual band name
var blue = image.select('b2');  // Adjust 'B2' to the actual band name b1 Coastal Blue for Planet
var green = image.select('b3'); // Adjust 'B3' to the actual band name b4 Green II for Planet
var red = image.select('b6');   // Adjust 'B4' to the actual band name

// Use the pre-defined sunglint geometry for sampling 
var sunglintRegion = sunglint;

// Perform linear regression between NIR and each visible band using reduceRegion
var blueRegression = image.select(['b8', 'b2'])
    .reduceRegion({
    reducer: ee.Reducer.linearFit(),
    geometry: sunglintRegion,
    scale: 3,
    maxPixels: 1e9
 });

var greenRegression = image.select(['b8', 'b3'])
    .reduceRegion({
    reducer: ee.Reducer.linearFit(),
    geometry: sunglintRegion,
    scale: 3,
    maxPixels: 1e9
});

var redRegression = image.select(['b8', 'b6'])
    .reduceRegion({
    reducer: ee.Reducer.linearFit(),
    geometry: sunglintRegion,
    scale: 3,
    maxPixels: 1e9
});

// Get the slope and intercept for each band
var slopeBlue = ee.Number(blueRegression.get('scale'));
var interceptBlue = ee.Number(blueRegression.get('offset'));

var slopeGreen = ee.Number(greenRegression.get('scale'));
var interceptGreen = ee.Number(greenRegression.get('offset'));

var slopeRed = ee.Number(redRegression.get('scale'));
var interceptRed = ee.Number(redRegression.get('offset'));

// Apply the deglinting correction // HOW TO UNDERSTAND THIS GRAPHICALLY?
var correctedBlue = blue.subtract(NIR.multiply(slopeBlue)).subtract(interceptBlue);
var correctedGreen = green.subtract(NIR.multiply(slopeGreen)).subtract(interceptGreen);
var correctedRed = red.subtract(NIR.multiply(slopeRed)).subtract(interceptRed);

// Combine the corrected bands into a new image
var deglintedImage = image.addBands(correctedBlue.rename('Blue_deglinted'))
                          .addBands(correctedGreen.rename('Green_deglinted'))
                          .addBands(correctedRed.rename('Red_deglinted'));
print('deglintedImage',deglintedImage)
Map.addLayer(deglintedImage, {bands: ['Red_deglinted', 'Green_deglinted', 'Blue_deglinted'], min: 0, max: 0.2, gamma: 2}, 'Deglinted Image');

Map.centerObject(sunglintRegion, 10);  // Center on the sunglint region
var img_masked = deglintedImage; 


// Apply Depth Invariant Index - DII --------------------------------------------------------------------------------------

// Define bands of interest for the DII:
var bands = ['b2','b3'] //Blue and Green; or b4 GREEN II for PlanetImage

// Get standard deviation values:
var imgSTD = img_masked.select(bands).reduceRegion({ //function computes statistics (e.g., mean, standard deviation)
reducer:ee.Reducer.stdDev(), //This applies the standard deviation reducer to calculate the spread of pixel values for the selected bands within the region.
geometry:sand_poly, //polygons of sand areas at different depths
  scale: 3,
  maxPixels:1e13}).toArray();
  
// Calculate the Variance:
var imgVAR = imgSTD.multiply(imgSTD).toList();

// Get mean values:
var imgMEAN = img_masked.reduceRegion({
  reducer:ee.Reducer.mean(),
  geometry:sand_poly,
  scale: 3,
  maxPixels:1e13}).toArray();
  
// Calculate the coefficient of variation:
var CV = imgSTD.divide(imgMEAN);

// Covariance Matrix for band pairs
var imgCOV = img_masked.toArray().reduceRegion({
  reducer: ee.Reducer.covariance(),
  geometry: sand_poly,
  scale: 3});
imgCOV = ee.Array(imgCOV.get('array'));

//Get covariances for band ratios
var imgCOVB23 =  ee.Number(imgCOV.get([0,1])); // Ratio b2/b3

// Attenuation Coefficient (a) of band pairs
var var2 = ee.Number(imgVAR.get(0)); // Variance of b2
var var3 = ee.Number(imgVAR.get(1)); // Variance of b3
var a2_3 = (var2.subtract(var3)).divide(imgCOVB23.multiply(2)); // b2b3

// Ratio of Attenuation Coefficient
var k2_3 = a2_3.add(((a2_3.multiply(a2_3).add(1))).pow(0.5)); // B2B3

// Depth invariance index DII
var DII_2_3 = img_masked.select('b2').log().subtract(img_masked.select('b3').log().multiply(k2_3)); // B2B3

// Make depth invariance images
var DI_image = ee.Image();
var DI_image = DI_image.addBands(DII_2_3.select(['b2'],['b2b3'])); // B2B3

// Add the b2/b3 as a band to our image:
var finalImage = img_masked.addBands(DI_image);// NEED TO ADD THE BAND TO THE IMAGE?

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
ee.String('Part C: Prepare training and testing data, and run a RandomForests classification algorithm or an SVM classification algorithm')

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
  scale: 3})   // Make each sample the same size as Planet pixel
  .randomColumn('random') // Create a column with random numbers //
  
  // Parse sample classes
var softbottomClass = samples.filter(ee.Filter.eq('cover',0)) //mud + sand + shell
var gravelClass = samples.filter(ee.Filter.eq('cover',1)) //Hard Bottom + macroalgae + shell + oyster
var savClass = samples.filter(ee.Filter.eq('cover',2)) //macroalgae + sand
var oysterClass = samples.filter(ee.Filter.eq('cover',3)) //oyster beds alone
var waterClass = samples.filter(ee.Filter.eq('cover',4)) //water canals

//// Generate random numbers from 0 to 1 for each sampled class.
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


// Define and train the SVM classifier:

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

// Classify the image using the trained classifier
var classifiedSVM = finalImage.classify(trainSVM);

// Display Classification Map and Accuracy Assessment

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


// Display Classified map
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

// Calculate accuracy using validation data
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

