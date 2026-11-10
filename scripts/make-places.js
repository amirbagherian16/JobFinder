// Generates public/data/places.json (US states + notable cities with coordinates).
const states = {
AL:['Alabama',32.8,-86.8],AK:['Alaska',64.2,-149.5],AZ:['Arizona',34.2,-111.7],AR:['Arkansas',34.9,-92.4],CA:['California',37.2,-119.5],
CO:['Colorado',39.0,-105.5],CT:['Connecticut',41.6,-72.7],DE:['Delaware',39.0,-75.5],DC:['District of Columbia',38.9,-77.03],FL:['Florida',28.6,-82.4],
GA:['Georgia',32.7,-83.4],HI:['Hawaii',20.8,-156.3],ID:['Idaho',44.4,-114.6],IL:['Illinois',40.0,-89.2],IN:['Indiana',39.9,-86.3],
IA:['Iowa',42.1,-93.5],KS:['Kansas',38.5,-98.4],KY:['Kentucky',37.5,-85.3],LA:['Louisiana',31.1,-92.0],ME:['Maine',45.3,-69.2],
MD:['Maryland',39.0,-76.8],MA:['Massachusetts',42.3,-71.8],MI:['Michigan',44.3,-85.4],MN:['Minnesota',46.3,-94.3],MS:['Mississippi',32.7,-89.7],
MO:['Missouri',38.4,-92.5],MT:['Montana',47.0,-109.6],NE:['Nebraska',41.5,-99.8],NV:['Nevada',39.3,-116.6],NH:['New Hampshire',43.7,-71.6],
NJ:['New Jersey',40.1,-74.7],NM:['New Mexico',34.4,-106.1],NY:['New York',42.9,-75.5],NC:['North Carolina',35.6,-79.4],ND:['North Dakota',47.5,-100.5],
OH:['Ohio',40.3,-82.8],OK:['Oklahoma',35.6,-97.5],OR:['Oregon',43.9,-120.6],PA:['Pennsylvania',40.9,-77.8],RI:['Rhode Island',41.7,-71.5],
SC:['South Carolina',33.9,-80.9],SD:['South Dakota',44.4,-100.2],TN:['Tennessee',35.8,-86.3],TX:['Texas',31.5,-99.3],UT:['Utah',39.3,-111.7],
VT:['Vermont',44.1,-72.7],VA:['Virginia',37.5,-78.8],WA:['Washington',47.4,-120.5],WV:['West Virginia',38.6,-80.6],WI:['Wisconsin',44.6,-89.9],WY:['Wyoming',43.0,-107.5]};
// [city, state, lat, lon] — includes research / biomech / defense hubs and large metros.
const cities = [
['San Antonio','TX',29.4241,-98.4936],['Austin','TX',30.2672,-97.7431],['Houston','TX',29.7604,-95.3698],['Dallas','TX',32.7767,-96.797],
['Fort Worth','TX',32.7555,-97.3308],['El Paso','TX',31.7619,-106.485],['College Station','TX',30.628,-96.3344],['Galveston','TX',29.3013,-94.7977],
['Corpus Christi','TX',27.8006,-97.3964],['New Braunfels','TX',29.703,-98.1245],['San Marcos','TX',29.8833,-97.9414],['Waco','TX',31.5493,-97.1467],
['Albuquerque','NM',35.0844,-106.6504],['Los Alamos','NM',35.8800,-106.3031],['Santa Fe','NM',35.687,-105.9378],['Phoenix','AZ',33.4484,-112.074],
['Tucson','AZ',32.2226,-110.9747],['Tempe','AZ',33.4255,-111.94],['Scottsdale','AZ',33.4942,-111.9261],['Denver','CO',39.7392,-104.9903],
['Boulder','CO',40.015,-105.2705],['Colorado Springs','CO',38.8339,-104.8214],['Salt Lake City','UT',40.7608,-111.891],['Las Vegas','NV',36.1699,-115.1398],
['Los Angeles','CA',34.0522,-118.2437],['San Diego','CA',32.7157,-117.1611],['San Francisco','CA',37.7749,-122.4194],['San Jose','CA',37.3382,-121.8863],
['Mountain View','CA',37.3861,-122.0839],['Menlo Park','CA',37.4530,-122.1817],['Palo Alto','CA',37.4419,-122.143],['Livermore','CA',37.6819,-121.768],
['Oakland','CA',37.8044,-122.2712],['Sacramento','CA',38.5816,-121.4944],['Irvine','CA',33.6846,-117.8265],['Santa Barbara','CA',34.4208,-119.6982],
['Seattle','WA',47.6062,-122.3321],['Redmond','WA',47.674,-122.1215],['Spokane','WA',47.6588,-117.426],['Portland','OR',45.5152,-122.6784],
['Boise','ID',43.615,-116.2023],['Minneapolis','MN',44.9778,-93.265],['Rochester','MN',44.0121,-92.4802],['Milwaukee','WI',43.0389,-87.9065],
['Madison','WI',43.0731,-89.4012],['Waukesha','WI',43.0117,-88.2315],['Chicago','IL',41.8781,-87.6298],['Evanston','IL',42.0451,-87.6877],
['Detroit','MI',42.3314,-83.0458],['Ann Arbor','MI',42.2808,-83.743],['Troy','MI',42.6064,-83.1498],['Dearborn','MI',42.3223,-83.1763],
['Farmington Hills','MI',42.4989,-83.3677],['Indianapolis','IN',39.7684,-86.1581],['West Lafayette','IN',40.4259,-86.9081],['Columbus','OH',39.9612,-82.9988],
['Cleveland','OH',41.4993,-81.6944],['Cincinnati','OH',39.1031,-84.512],['Dayton','OH',39.7589,-84.1916],['Pittsburgh','PA',40.4406,-79.9959],
['Philadelphia','PA',39.9526,-75.1652],['Malvern','PA',40.0362,-75.5138],['Canonsburg','PA',40.2626,-80.1873],['State College','PA',40.7934,-77.86],
['New York','NY',40.7128,-74.006],['Buffalo','NY',42.8864,-78.8784],['Rochester','NY',43.1566,-77.6088],['Albany','NY',42.6526,-73.7562],
['Ithaca','NY',42.444,-76.5019],['Boston','MA',42.3601,-71.0589],['Cambridge','MA',42.3736,-71.1097],['Billerica','MA',42.5584,-71.269],
['Natick','MA',42.2834,-71.3495],['Worcester','MA',42.2626,-71.8023],['Providence','RI',41.824,-71.4128],['Johnston','RI',41.8210,-71.5128],
['New Haven','CT',41.3083,-72.9279],['Hartford','CT',41.7658,-72.6734],['Newark','NJ',40.7357,-74.1724],['Princeton','NJ',40.3573,-74.6672],
['Baltimore','MD',39.2904,-76.6122],['Bethesda','MD',38.9807,-77.1003],['Silver Spring','MD',38.9907,-77.0261],['Laurel','MD',39.0993,-76.8483],
['Aberdeen','MD',39.5096,-76.1641],['Rockville','MD',39.084,-77.1528],['Frederick','MD',39.4143,-77.4105],['Washington','DC',38.9072,-77.0369],
['Arlington','VA',38.8816,-77.091],['Charlottesville','VA',38.0293,-78.4767],['Richmond','VA',37.5407,-77.436],['Blacksburg','VA',37.2296,-80.4139],
['Winston-Salem','NC',36.0999,-80.2442],['Durham','NC',35.994,-78.8986],['Raleigh','NC',35.7796,-78.6382],['Chapel Hill','NC',35.9132,-79.0558],
['Charlotte','NC',35.2271,-80.8431],['Atlanta','GA',33.749,-84.388],['Charleston','SC',32.7765,-79.9311],['Greenville','SC',34.8526,-82.394],
['Nashville','TN',36.1627,-86.7816],['Memphis','TN',35.1495,-90.049],['Oak Ridge','TN',36.0104,-84.2696],['Birmingham','AL',33.5186,-86.8104],
['Huntsville','AL',34.7304,-86.5861],['Orlando','FL',28.5383,-81.3792],['Tampa','FL',27.9506,-82.4572],['Miami','FL',25.7617,-80.1918],
['Gainesville','FL',29.6516,-82.3248],['Jacksonville','FL',30.3322,-81.6557],['New Orleans','LA',29.9511,-90.0715],['Baton Rouge','LA',30.4515,-91.1871],
['Little Rock','AR',34.7465,-92.2896],['Oklahoma City','OK',35.4676,-97.5164],['Tulsa','OK',36.154,-95.9928],['Kansas City','MO',39.0997,-94.5786],
['St. Louis','MO',38.627,-90.1994],['Omaha','NE',41.2565,-95.9345],['Iowa City','IA',41.6611,-91.5302],['Louisville','KY',38.2527,-85.7585],
['Lexington','KY',38.0406,-84.5037],['Honolulu','HI',21.3069,-157.8583],['Anchorage','AK',61.2181,-149.9003]];
const fs = require('fs'), path = require('path');
fs.mkdirSync(path.join(__dirname, '..', 'public', 'data'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '..', 'public', 'data', 'places.json'), JSON.stringify({ states, cities }, null, 0));
console.log('places.json:', Object.keys(states).length, 'states,', cities.length, 'cities');
