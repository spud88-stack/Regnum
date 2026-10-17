// Geography of the Old World: projection, coastlines, and the de jure title hierarchy.
// Coordinates are [lon, lat]. Counties: [name, lon, lat, terrain].

export const PROJ = { lon0: -11, lon1: 50, lat0: 28, lat1: 64, kx: Math.cos(46 * Math.PI / 180) };

// Land polygons (filled), then sea polygons (subtracted).
export const LAND = [
  // Eurasia + North Africa mainland
  [[-5.6,36.0],[-6.3,36.5],[-7.4,37.2],[-8.9,37.0],[-8.8,38.0],[-9.5,38.7],[-9.0,39.6],[-8.8,40.6],[-8.9,42.0],[-9.3,42.9],[-8.3,43.6],[-7.0,43.6],[-5.7,43.6],[-3.8,43.45],[-2.0,43.35],[-1.5,43.5],
   [-1.2,44.6],[-1.2,45.6],[-1.6,46.4],[-2.2,47.1],[-3.0,47.5],[-4.4,47.8],[-4.8,48.4],[-3.5,48.85],[-2.0,48.65],[-1.6,48.7],[-1.9,49.7],[-1.2,49.4],[0.2,49.45],[1.0,49.9],[1.6,50.3],[1.6,50.9],
   [2.6,51.1],[3.6,51.5],[4.2,52.0],[4.6,52.6],[4.8,53.0],[5.6,53.4],[7.0,53.6],[8.5,53.6],[8.6,54.0],[8.6,55.0],[8.1,55.5],[8.2,56.6],[8.6,57.1],[10.6,57.7],[10.4,57.0],[10.3,56.3],[10.0,55.7],[9.7,55.3],[9.9,54.8],
   [10.9,54.4],[10.8,54.0],[11.5,54.1],[12.5,54.5],[13.4,54.6],[14.2,53.9],[15.5,54.2],[16.5,54.55],[18.0,54.8],[18.6,54.4],[19.7,54.4],[21.0,55.2],[21.1,55.7],[21.0,56.5],[21.6,57.4],[22.6,57.7],[23.3,57.1],[24.1,57.0],
   [24.4,57.9],[23.6,58.4],[23.4,59.0],[24.7,59.5],[26.5,59.5],[28.0,59.5],[29.8,59.95],[29.0,60.2],[27.5,60.5],[25.5,60.3],[23.0,59.9],[22.0,60.4],[21.3,61.0],[21.5,62.0],[21.2,62.8],[22.5,63.8],[23.5,64.3],[24.0,66.5],
   [53,66.5],[53,25],[-14,25],[-13,27.9],[-11,28.5],[-9.8,29.6],[-9.7,30.9],[-9.8,31.5],[-9.2,32.5],[-8.5,33.3],[-7.6,33.6],[-6.8,34.1],[-6.3,35.0],[-5.9,35.8],[-5.3,35.9],[-4.5,35.2],[-3.0,35.3],[-2.0,35.1],
   [-1.0,35.7],[0.0,35.9],[1.5,36.5],[3.0,36.8],[5.0,36.8],[6.5,37.1],[8.5,36.9],[9.8,37.35],[10.3,36.9],[11.1,37.1],[10.5,36.3],[11.1,35.5],[10.4,34.6],[10.1,33.9],[11.1,33.2],[13.2,32.9],[15.2,32.3],[15.8,31.4],
   [17.5,30.9],[19.0,30.3],[20.0,31.0],[20.0,32.0],[21.5,32.9],[22.6,32.8],[23.2,32.3],[25.0,31.6],[27.3,31.4],[29.0,30.9],[29.9,31.25],[31.0,31.6],[32.3,31.3],[34.2,31.3],[34.5,31.6],[34.9,32.4],[35.1,33.1],[35.5,33.9],
   [35.8,34.5],[35.9,35.4],[35.8,36.0],[36.1,36.8],[35.5,36.6],[34.6,36.8],[33.6,36.2],[32.5,36.1],[31.5,36.7],[30.6,36.85],[30.4,36.3],[29.3,36.3],[28.2,36.7],[27.4,37.0],[27.2,37.7],[26.6,38.4],[26.9,39.0],[26.2,39.5],
   [26.5,40.3],[26.2,40.6],[26.0,40.8],[24.5,40.9],[23.8,40.7],[22.9,40.6],[23.3,40.2],[22.6,40.0],[22.9,39.3],[23.2,38.9],[24.0,38.2],[23.4,37.9],[23.2,37.4],[23.0,36.5],[22.4,36.5],[21.7,36.8],[21.3,37.7],[21.1,38.3],
   [20.8,38.9],[20.2,39.5],[19.5,40.4],[19.4,41.0],[19.5,41.8],[18.6,42.4],[17.6,43.0],[16.4,43.5],[15.2,44.2],[14.4,45.1],[13.9,44.8],[13.5,45.6],[12.5,45.5],[12.3,44.8],[12.6,44.0],[13.6,43.5],[14.2,42.4],[15.2,41.9],
   [16.1,41.9],[15.9,41.5],[16.9,41.1],[18.0,40.6],[18.5,40.1],[17.9,40.3],[17.2,40.4],[16.6,40.0],[17.1,39.4],[16.5,38.8],[16.6,38.4],[15.7,37.9],[15.6,38.3],[16.0,39.2],[15.7,39.9],[15.0,40.3],[14.4,40.6],[14.2,40.8],
   [13.8,41.2],[12.9,41.4],[12.2,41.8],[11.5,42.3],[10.6,42.9],[10.3,43.5],[10.0,44.0],[9.0,44.4],[8.2,43.9],[7.4,43.75],[6.6,43.2],[5.4,43.2],[4.6,43.4],[3.5,43.3],[3.1,42.6],[3.2,42.0],[2.2,41.35],[1.0,41.0],
   [0.6,40.6],[0.0,39.9],[-0.3,39.4],[0.2,38.8],[-0.5,38.3],[-0.8,37.6],[-1.6,37.3],[-2.0,36.8],[-3.0,36.75],[-4.4,36.7],[-5.3,36.2]],
  // Scandinavia
  [[12.0,66.5],[10.0,64.4],[8.5,63.6],[7.0,63.0],[5.6,62.4],[5.0,61.6],[4.9,60.8],[5.0,60.0],[5.4,59.2],[5.6,58.7],[6.6,58.1],[7.5,58.0],[8.5,58.3],[9.6,59.0],[10.5,59.5],[10.7,59.8],[10.6,59.2],[11.2,59.1],[11.8,58.5],
   [11.9,57.7],[12.6,56.6],[12.9,56.0],[12.95,55.4],[14.2,55.4],[14.4,56.0],[15.8,56.1],[16.4,56.6],[16.6,57.6],[16.8,58.6],[18.0,59.0],[18.9,59.6],[18.2,60.3],[17.3,60.7],[17.4,61.7],[17.6,62.5],[18.6,63.3],[20.3,63.8],[21.2,64.3],[22.0,66.5]],
  // Great Britain
  [[-5.7,50.05],[-4.2,50.35],[-3.4,50.6],[-2.5,50.6],[-1.3,50.75],[0.2,50.75],[1.4,51.15],[1.4,51.4],[0.6,51.5],[1.0,51.8],[1.75,52.5],[1.6,52.95],[0.5,52.95],[0.2,53.5],[-0.1,54.1],[-0.5,54.5],[-1.2,54.7],[-1.5,55.3],
   [-1.8,55.65],[-2.4,56.0],[-3.0,56.05],[-2.6,56.25],[-2.5,56.6],[-2.1,57.2],[-1.8,57.6],[-3.0,57.7],[-4.0,57.6],[-3.5,58.1],[-3.0,58.65],[-5.0,58.6],[-5.3,58.2],[-5.8,57.5],[-5.6,56.5],[-5.7,55.7],[-4.9,55.7],[-4.9,55.1],
   [-5.1,54.85],[-4.0,54.8],[-3.4,54.9],[-3.4,54.4],[-3.0,54.0],[-3.0,53.5],[-3.4,53.35],[-4.5,53.4],[-4.7,52.8],[-4.1,52.4],[-4.8,51.9],[-5.2,51.75],[-4.3,51.6],[-3.2,51.45],[-3.3,51.2],[-4.2,51.2],[-5.5,50.4]],
  // Ireland
  [[-5.9,54.6],[-6.2,54.0],[-6.1,53.3],[-6.0,52.6],[-6.4,52.2],[-7.5,52.0],[-8.5,51.6],[-9.8,51.5],[-10.3,52.1],[-9.6,52.6],[-9.9,53.4],[-10.0,53.5],[-10.0,54.2],[-8.6,54.3],[-8.8,54.7],[-8.0,55.2],[-7.0,55.25],[-6.1,55.2],[-5.5,54.6]],
  // Zealand, Funen
  [[10.9,55.7],[11.5,56.0],[12.3,56.1],[12.6,55.7],[12.2,55.2],[11.8,55.0],[11.2,55.2]],
  [[9.7,55.5],[10.4,55.6],[10.8,55.3],[10.5,55.0],[9.9,55.1]],
  // Sicily, Sardinia, Corsica, Crete, Cyprus, Mallorca
  [[12.4,37.8],[13.4,38.2],[15.0,38.1],[15.65,38.3],[15.3,37.4],[15.1,36.7],[14.4,36.8],[12.9,37.5]],
  [[8.4,40.9],[9.2,41.25],[9.8,40.8],[9.65,39.6],[9.1,39.1],[8.4,38.9],[8.4,39.8],[8.2,40.6]],
  [[8.6,41.4],[9.2,41.4],[9.5,42.0],[9.45,43.0],[8.7,42.6],[8.6,42.0]],
  [[23.5,35.3],[24.3,35.6],[26.3,35.3],[26.1,35.0],[24.7,34.9],[23.5,35.2]],
  [[32.3,35.0],[32.9,35.4],[34.6,35.7],[34.0,35.0],[33.0,34.6],[32.4,34.7]],
  [[2.4,39.6],[3.2,39.95],[3.5,39.7],[3.1,39.3],[2.7,39.5]],
  // Euboea & Rhodes (decorative)
  [[22.8,38.8],[23.6,38.7],[24.6,38.0],[24.2,38.0],[23.3,38.4]],
  [[27.7,36.1],[28.2,36.45],[28.25,36.1],[27.8,35.9]],
];

export const SEAS = [
  // Black Sea
  [[29.1,41.2],[30.5,41.15],[31.4,41.25],[33.3,42.0],[35.2,42.1],[36.0,41.7],[37.5,41.1],[39.7,40.95],[41.5,41.5],[41.6,42.2],[40.9,42.9],[39.7,43.6],[38.0,44.5],[37.3,44.8],[36.6,45.1],[35.5,45.0],[34.4,44.5],[33.5,44.5],
   [33.4,45.2],[32.5,45.4],[33.0,45.9],[31.8,46.5],[30.8,46.5],[30.2,45.8],[29.7,45.2],[28.8,44.5],[28.6,43.4],[27.9,43.2],[27.5,42.5],[28.0,41.8],[28.9,41.4]],
  // Sea of Azov
  [[35.2,45.5],[35.0,46.2],[36.5,46.7],[38.0,47.1],[39.2,47.2],[38.4,46.3],[37.6,45.7],[36.6,45.4]],
  // Caspian
  [[47.6,45.6],[47.0,45.0],[47.4,44.5],[47.6,43.0],[48.4,42.0],[49.0,41.2],[49.6,40.5],[49.2,39.5],[49.0,38.4],[49.6,37.4],[50.5,37.0],[53,37],[53,47],[49.0,46.6]],
  // Persian Gulf
  [[48.0,29.3],[48.5,29.95],[49.2,30.1],[50.1,30.0],[53,29],[53,25],[49.5,26.5],[48.6,27.8]],
  // Red Sea gulfs
  [[32.5,30.0],[33.0,28.8],[33.9,27.7],[34.4,28.0],[34.8,29.0],[35.0,29.5],[35.2,28.5],[36.5,25],[32.6,25],[32.6,28.5]],
  // Lakes Ladoga, Onega, Van
  [[30.5,60.0],[32.5,60.2],[32.9,61.0],[31.5,61.7],[30.2,61.3],[29.9,60.6]],
  [[34.5,61.0],[36.0,61.2],[36.2,62.0],[35.3,62.8],[34.4,62.4]],
  [[42.4,38.6],[43.0,38.9],[43.6,38.6],[43.2,38.3],[42.6,38.3]],
];

// Impassable wasteland seeds (deserts, frozen wastes, high mountains)
export const WASTES = [
  [-6,29.0],[-2,29.5],[2,29.6],[5,30.2],[8,30.6],[11,30.6],[14,30.6],[17,29.5],[21,29.4],[24,29.6],[27,29.6],[33.9,29.4],
  [37.5,30.5],[40,31.5],[42,30.0],[45,29.2],[39,33.6],[41.5,33.2],[44.8,61.5],[48.5,60.5],[46,63.5],[40,63.5],[49,64],
  [20.5,30.5],[-9.5,28.8],[8.5,33.0],[3.0,32.8],[-1.5,32.0],[25.5,30.5],[29,29.0],
];

// Narrow straits armies may cross on foot (province names).
export const STRAITS = [
  ['Constantinople','Nicaea'], ['Seville','Tangier'], ['Calabria','Messina'], ['Roskilde','Lund'], ['Roskilde','Aarhus'],
];

const C = (name, lon, lat, t) => [name, lon, lat, t];

// De jure hierarchy. Each duchy has a baseline culture/faith (around 1066), overridden per bookmark.
export const DEJURE = {
  e_britannia: { name: 'Britannia', color: '#9c2a2a', kingdoms: {
    k_england: { name: 'England', color: '#b52d2d', duchies: {
      d_wessex: { name: 'Wessex', cul: 'english', fai: 'catholic', counties: [C('Winchester',-1.3,51.06,'farmland'), C('Exeter',-3.53,50.72,'hills'), C('Cornwall',-4.85,50.42,'hills')] },
      d_essex: { name: 'Essex', cul: 'english', fai: 'catholic', counties: [C('London',-0.12,51.5,'farmland'), C('Canterbury',1.0,51.25,'farmland'), C('Colchester',0.9,51.89,'plains')] },
      d_east_anglia: { name: 'East Anglia', cul: 'english', fai: 'catholic', counties: [C('Norwich',1.1,52.63,'wetlands'), C('Lincoln',-0.4,53.23,'plains')] },
      d_mercia: { name: 'Mercia', cul: 'english', fai: 'catholic', counties: [C('Tamworth',-1.69,52.63,'farmland'), C('Gloucester',-2.24,51.86,'hills'), C('Chester',-2.75,53.19,'plains')] },
      d_northumbria: { name: 'Northumbria', cul: 'english', fai: 'catholic', counties: [C('York',-1.08,53.96,'plains'), C('Durham',-1.67,54.78,'hills'), C('Lancaster',-2.7,54.25,'hills')] },
    }},
    k_wales: { name: 'Wales', color: '#c8452b', duchies: {
      d_wales: { name: 'Wales', cul: 'welsh', fai: 'catholic', counties: [C('Gwynedd',-3.9,52.95,'mountains'), C('Powys',-3.4,52.4,'hills'), C('Deheubarth',-4.2,51.85,'hills')] },
    }},
    k_scotland: { name: 'Scotland', color: '#3a5fa8', duchies: {
      d_lothian: { name: 'Lothian', cul: 'scottish', fai: 'catholic', counties: [C('Edinburgh',-3.0,55.8,'plains'), C('Strathclyde',-4.3,55.6,'hills')] },
      d_alba: { name: 'Alba', cul: 'scottish', fai: 'catholic', counties: [C('Scone',-3.43,56.4,'hills'), C('Aberdeen',-2.5,57.2,'hills'), C('Moray',-4.4,57.6,'mountains'), C('Argyll',-5.2,56.4,'mountains')] },
    }},
    k_ireland: { name: 'Ireland', color: '#3a8a4c', duchies: {
      d_ulster: { name: 'Ulaid', cul: 'irish', fai: 'catholic', counties: [C('Ulster',-6.6,54.7,'hills'), C('Connacht',-8.8,53.7,'wetlands')] },
      d_leinster: { name: 'Leinster', cul: 'irish', fai: 'catholic', counties: [C('Dublin',-6.5,53.3,'plains'), C('Munster',-8.6,52.0,'hills'), C('Thomond',-8.8,52.75,'plains')] },
    }},
  }},
  e_francia: { name: 'Francia', color: '#2d4f9c', kingdoms: {
    k_france: { name: 'France', color: '#2f55b0', duchies: {
      d_ile_de_france: { name: 'Île-de-France', cul: 'french', fai: 'catholic', counties: [C('Paris',2.35,48.86,'farmland'), C('Orléans',1.9,47.9,'farmland')] },
      d_champagne: { name: 'Champagne', cul: 'french', fai: 'catholic', counties: [C('Troyes',4.07,48.3,'farmland'), C('Reims',4.03,49.26,'farmland')] },
      d_normandy: { name: 'Normandy', cul: 'norman', fai: 'catholic', counties: [C('Rouen',1.0,49.44,'farmland'), C('Bayeux',-0.6,49.1,'farmland')] },
      d_brittany: { name: 'Brittany', cul: 'breton', fai: 'catholic', counties: [C('Rennes',-1.68,48.11,'forest'), C('Brest',-3.9,48.3,'hills'), C('Nantes',-1.55,47.22,'plains')] },
      d_flanders: { name: 'Flanders', cul: 'dutch', fai: 'catholic', counties: [C('Bruges',3.22,51.1,'wetlands'), C('Artois',2.5,50.4,'farmland')] },
      d_anjou: { name: 'Anjou', cul: 'french', fai: 'catholic', counties: [C('Angers',-0.55,47.47,'farmland'), C('Tours',0.69,47.39,'farmland')] },
      d_burgundy: { name: 'Burgundy', cul: 'french', fai: 'catholic', counties: [C('Dijon',5.04,47.32,'farmland'), C('Auxerre',3.57,47.8,'plains')] },
    }},
    k_aquitaine: { name: 'Aquitaine', color: '#6b8fd6', duchies: {
      d_aquitaine: { name: 'Aquitaine', cul: 'occitan', fai: 'catholic', counties: [C('Poitiers',0.34,46.58,'plains'), C('Limoges',1.26,45.83,'hills'), C('Bordeaux',-0.58,44.84,'farmland')] },
      d_gascony: { name: 'Gascony', cul: 'occitan', fai: 'catholic', counties: [C('Dax',-0.9,43.7,'forest'), C('Armagnac',0.4,43.6,'hills')] },
      d_toulouse: { name: 'Toulouse', cul: 'occitan', fai: 'catholic', counties: [C('Toulouse',1.44,43.6,'farmland'), C('Narbonne',2.8,43.18,'plains')] },
      d_auvergne: { name: 'Auvergne', cul: 'occitan', fai: 'catholic', counties: [C('Clermont',3.08,45.78,'mountains'), C('Rodez',2.57,44.35,'hills'), C('Bourges',2.4,47.08,'farmland')] },
    }},
    k_burgundy: { name: 'Arles', color: '#9a6ad0', duchies: {
      d_provence: { name: 'Provence', cul: 'occitan', fai: 'catholic', counties: [C('Marseille',5.6,43.4,'hills'), C('Avignon',4.8,43.95,'plains'), C('Nice',6.9,43.85,'mountains'), C('Grenoble',5.72,45.19,'mountains')] },
      d_upper_burgundy: { name: 'Upper Burgundy', cul: 'french', fai: 'catholic', counties: [C('Lyon',4.83,45.76,'plains'), C('Besançon',6.02,47.24,'hills'), C('Bern',7.45,46.85,'mountains'), C('Geneva',6.3,46.2,'mountains')] },
    }},
  }},
  e_hre: { name: 'Germania', color: '#8a8a8a', kingdoms: {
    k_germany: { name: 'Germany', color: '#7f7f7f', duchies: {
      d_saxony: { name: 'Saxony', cul: 'german', fai: 'catholic', counties: [C('Brunswick',10.52,52.27,'plains'), C('Magdeburg',11.63,52.13,'plains'), C('Hamburg',10.0,53.55,'plains')] },
      d_westphalia: { name: 'Westphalia', cul: 'german', fai: 'catholic', counties: [C('Osnabrück',7.8,52.1,'plains'), C('Bremen',8.8,53.08,'wetlands')] },
      d_thuringia: { name: 'Thuringia', cul: 'german', fai: 'catholic', counties: [C('Erfurt',11.03,50.98,'forest'), C('Meissen',13.47,51.16,'hills'), C('Lusatia',14.33,51.75,'forest')] },
      d_franconia: { name: 'Franconia', cul: 'german', fai: 'catholic', counties: [C('Würzburg',9.93,49.79,'forest'), C('Mainz',8.27,50.0,'farmland'), C('Nuremberg',11.08,49.45,'forest'), C('Fulda',9.68,50.55,'forest')] },
      d_swabia: { name: 'Swabia', cul: 'german', fai: 'catholic', counties: [C('Augsburg',10.9,48.37,'farmland'), C('Konstanz',9.17,47.66,'hills'), C('Strasbourg',7.75,48.58,'farmland')] },
      d_bavaria: { name: 'Bavaria', cul: 'german', fai: 'catholic', counties: [C('Regensburg',12.1,49.01,'hills'), C('Munich',11.58,48.14,'farmland'), C('Salzburg',13.05,47.8,'mountains'), C('Tyrol',11.4,47.27,'mountains')] },
      d_austria: { name: 'Austria', cul: 'german', fai: 'catholic', counties: [C('Vienna',16.37,48.21,'farmland'), C('Styria',15.44,47.07,'mountains')] },
      d_carinthia: { name: 'Carinthia', cul: 'slovene', fai: 'catholic', counties: [C('Klagenfurt',14.3,46.62,'mountains'), C('Carniola',14.5,46.05,'mountains')] },
    }},
    k_lotharingia: { name: 'Lotharingia', color: '#c9b13a', duchies: {
      d_lorraine: { name: 'Lorraine', cul: 'german', fai: 'catholic', counties: [C('Metz',6.18,49.12,'farmland'), C('Trier',6.64,49.75,'hills'), C('Cologne',6.96,50.94,'farmland'), C('Liège',5.57,50.63,'forest')] },
      d_holland: { name: 'Holland', cul: 'dutch', fai: 'catholic', counties: [C('Utrecht',5.12,52.09,'wetlands'), C('Friesland',5.8,53.1,'wetlands'), C('Brabant',4.35,50.95,'farmland')] },
    }},
    k_pomerania: { name: 'Pomerania', color: '#5f8f8f', duchies: {
      d_brandenburg: { name: 'Brandenburg', cul: 'polabian', fai: 'slavic_pagan', counties: [C('Brandenburg',12.9,52.41,'forest'), C('Mecklenburg',11.6,53.63,'forest')] },
      d_pomerania: { name: 'Pomerania', cul: 'pomeranian', fai: 'slavic_pagan', counties: [C('Stettin',14.55,53.43,'forest'), C('Kolberg',16.0,53.9,'forest'), C('Danzig',18.4,54.1,'forest')] },
    }},
    k_bohemia: { name: 'Bohemia', color: '#c76f2a', duchies: {
      d_bohemia: { name: 'Bohemia', cul: 'czech', fai: 'catholic', counties: [C('Prague',14.42,50.08,'hills'), C('Pilsen',13.38,49.75,'forest')] },
      d_moravia: { name: 'Moravia', cul: 'czech', fai: 'catholic', counties: [C('Brno',16.6,49.2,'farmland'), C('Olomouc',17.4,49.7,'hills')] },
    }},
  }},
  e_italy: { name: 'Italia', color: '#3d8a5a', kingdoms: {
    k_italy: { name: 'Italy', color: '#4ba36b', duchies: {
      d_lombardy: { name: 'Lombardy', cul: 'italian', fai: 'catholic', counties: [C('Milan',9.19,45.46,'farmland'), C('Turin',7.69,45.07,'hills'), C('Genoa',8.93,44.5,'hills')] },
      d_verona: { name: 'Verona', cul: 'italian', fai: 'catholic', counties: [C('Verona',10.99,45.44,'farmland'), C('Venice',12.2,45.5,'wetlands'), C('Friuli',13.37,45.9,'plains')] },
      d_tuscany: { name: 'Tuscany', cul: 'italian', fai: 'catholic', counties: [C('Florence',11.25,43.77,'hills'), C('Pisa',10.6,43.6,'plains')] },
      d_romagna: { name: 'Romagna', cul: 'italian', fai: 'catholic', counties: [C('Bologna',11.34,44.49,'farmland'), C('Ravenna',12.1,44.3,'wetlands')] },
      d_latium: { name: 'Latium', cul: 'italian', fai: 'catholic', counties: [C('Rome',12.6,41.9,'plains'), C('Spoleto',12.74,42.73,'mountains'), C('Ancona',13.3,43.5,'hills')] },
    }},
    k_sicily: { name: 'Sicily', color: '#d9b84a', duchies: {
      d_apulia: { name: 'Apulia', cul: 'italian', fai: 'catholic', counties: [C('Bari',16.6,41.0,'plains'), C('Taranto',17.3,40.55,'plains'), C('Benevento',14.78,41.13,'hills')] },
      d_campania: { name: 'Calabria', cul: 'italian', fai: 'catholic', counties: [C('Naples',14.4,40.9,'farmland'), C('Calabria',16.3,39.1,'mountains')] },
      d_sicily: { name: 'Sicily', cul: 'sicilian', fai: 'catholic', counties: [C('Palermo',13.4,37.95,'hills'), C('Syracuse',14.9,37.2,'plains'), C('Messina',15.0,37.85,'hills')] },
    }},
    k_sardinia: { name: 'Sardinia', color: '#88b66a', duchies: {
      d_sardinia: { name: 'Sardinia', cul: 'sardinian', fai: 'catholic', counties: [C('Cagliari',9.0,39.4,'hills'), C('Torres',8.8,40.6,'hills')] },
      d_corsica: { name: 'Corsica', cul: 'italian', fai: 'catholic', counties: [C('Corsica',9.0,42.1,'mountains')] },
    }},
  }},
  e_spain: { name: 'Hispania', color: '#c6a33a', kingdoms: {
    k_castile: { name: 'Castile', color: '#d6b13c', duchies: {
      d_castile: { name: 'Castile', cul: 'castilian', fai: 'catholic', counties: [C('Burgos',-3.7,42.34,'plains'), C('Soria',-2.46,41.76,'hills')] },
      d_leon: { name: 'León', cul: 'castilian', fai: 'catholic', counties: [C('León',-5.57,42.6,'plains'), C('Salamanca',-5.66,40.97,'plains'), C('Plasencia',-6.09,40.03,'hills')] },
      d_asturias: { name: 'Asturias', cul: 'castilian', fai: 'catholic', counties: [C('Oviedo',-5.85,43.3,'mountains'), C('Santiago',-8.3,42.8,'hills')] },
      d_toledo: { name: 'Toledo', cul: 'andalusian', fai: 'sunni', counties: [C('Toledo',-4.02,39.86,'plains'), C('Cuenca',-2.13,40.07,'hills'), C('Calatrava',-3.9,38.98,'plains')] },
    }},
    k_portugal: { name: 'Portugal', color: '#3e7a3e', duchies: {
      d_porto: { name: 'Porto', cul: 'portuguese', fai: 'catholic', counties: [C('Porto',-8.4,41.2,'hills'), C('Coimbra',-8.3,40.2,'hills')] },
      d_lisbon: { name: 'Lisbon', cul: 'portuguese', fai: 'sunni', counties: [C('Lisbon',-9.0,38.8,'farmland'), C('Évora',-7.9,38.57,'plains'), C('Algarve',-8.2,37.2,'plains')] },
    }},
    k_aragon: { name: 'Aragon', color: '#d8933a', duchies: {
      d_navarra: { name: 'Navarra', cul: 'basque', fai: 'catholic', counties: [C('Pamplona',-1.64,42.81,'mountains'), C('Vizcaya',-2.8,43.15,'hills')] },
      d_aragon: { name: 'Aragon', cul: 'aragonese', fai: 'sunni', counties: [C('Zaragoza',-0.88,41.65,'plains'), C('Jaca',-0.55,42.5,'mountains')] },
      d_barcelona: { name: 'Barcelona', cul: 'catalan', fai: 'catholic', counties: [C('Barcelona',2.0,41.5,'hills'), C('Urgell',1.1,42.0,'mountains'), C('Tortosa',0.4,40.85,'plains')] },
      d_valencia: { name: 'Valencia', cul: 'andalusian', fai: 'sunni', counties: [C('Valencia',-0.5,39.47,'farmland'), C('Murcia',-1.13,38.0,'drylands')] },
    }},
    k_andalusia: { name: 'Andalusia', color: '#2f8a5f', duchies: {
      d_cordoba: { name: 'Córdoba', cul: 'andalusian', fai: 'sunni', counties: [C('Córdoba',-4.78,37.89,'farmland'), C('Jaén',-3.6,37.77,'hills')] },
      d_seville: { name: 'Seville', cul: 'andalusian', fai: 'sunni', counties: [C('Seville',-5.9,37.3,'farmland'), C('Badajoz',-6.8,38.88,'plains')] },
      d_granada: { name: 'Granada', cul: 'andalusian', fai: 'sunni', counties: [C('Granada',-3.6,37.18,'mountains'), C('Almería',-2.4,37.0,'drylands'), C('Málaga',-4.6,36.85,'hills')] },
    }},
  }},
  e_scandinavia: { name: 'Scandinavia', color: '#5a6f9a', kingdoms: {
    k_denmark: { name: 'Denmark', color: '#c03a45', duchies: {
      d_jutland: { name: 'Jutland', cul: 'danish', fai: 'catholic', counties: [C('Aarhus',9.6,56.3,'plains'), C('Ribe',8.9,55.4,'plains'), C('Schleswig',9.4,54.6,'plains')] },
      d_zealand: { name: 'Zealand', cul: 'danish', fai: 'catholic', counties: [C('Roskilde',11.8,55.55,'farmland'), C('Lund',13.4,55.75,'farmland')] },
    }},
    k_norway: { name: 'Norway', color: '#8a3a3a', duchies: {
      d_vestlandet: { name: 'Vestlandet', cul: 'norwegian', fai: 'catholic', counties: [C('Bergen',5.9,60.5,'mountains'), C('Stavanger',6.4,58.9,'mountains')] },
      d_ostlandet: { name: 'Østlandet', cul: 'norwegian', fai: 'catholic', counties: [C('Oslo',10.4,59.95,'forest'), C('Hamar',10.5,61.2,'mountains'), C('Trondheim',10.6,63.2,'mountains')] },
    }},
    k_sweden: { name: 'Sweden', color: '#3a6fb0', duchies: {
      d_svealand: { name: 'Svealand', cul: 'swedish', fai: 'catholic', counties: [C('Uppsala',17.64,59.86,'forest'), C('Närke',15.2,59.27,'forest'), C('Dalarna',14.6,60.8,'forest'), C('Hälsingland',16.5,62.0,'taiga'), C('Jämtland',14.0,63.3,'taiga')] },
      d_gotaland: { name: 'Götaland', cul: 'swedish', fai: 'catholic', counties: [C('Skara',13.2,58.3,'forest'), C('Linköping',15.62,58.41,'forest'), C('Småland',15.3,57.0,'forest')] },
    }},
    k_finland: { name: 'Finland', color: '#6ab0b0', duchies: {
      d_finland: { name: 'Finland', cul: 'finnish', fai: 'finnic_pagan', counties: [C('Turku',22.5,60.6,'taiga'), C('Häme',24.46,61.3,'taiga'), C('Ostrobothnia',23.0,63.0,'taiga'), C('Savonia',27.5,62.3,'taiga')] },
      d_karelia: { name: 'Karelia', cul: 'karelian', fai: 'finnic_pagan', counties: [C('Vyborg',28.9,60.9,'taiga'), C('Karelia',32.8,62.6,'taiga')] },
    }},
  }},
  e_wendish: { name: 'Wendish Empire', color: '#b0484f', kingdoms: {
    k_poland: { name: 'Poland', color: '#c8505a', duchies: {
      d_greater_poland: { name: 'Greater Poland', cul: 'polish', fai: 'catholic', counties: [C('Gniezno',17.6,52.53,'plains'), C('Kalisz',18.09,51.76,'plains')] },
      d_lesser_poland: { name: 'Lesser Poland', cul: 'polish', fai: 'catholic', counties: [C('Kraków',19.94,50.06,'hills'), C('Sandomierz',21.75,50.68,'plains'), C('Lublin',22.57,51.25,'plains')] },
      d_masovia: { name: 'Masovia', cul: 'polish', fai: 'catholic', counties: [C('Płock',19.7,52.55,'forest'), C('Warsaw',21.2,52.23,'forest')] },
      d_silesia: { name: 'Silesia', cul: 'polish', fai: 'catholic', counties: [C('Wrocław',17.03,51.11,'plains'), C('Opole',17.9,50.5,'plains')] },
    }},
    k_lithuania: { name: 'Lithuania', color: '#a0703a', duchies: {
      d_lithuania: { name: 'Lithuania', cul: 'lithuanian', fai: 'baltic_pagan', counties: [C('Vilnius',25.28,54.69,'forest'), C('Kaunas',23.9,55.0,'forest'), C('Samogitia',22.3,55.8,'forest')] },
      d_prussia: { name: 'Prussia', cul: 'prussian', fai: 'baltic_pagan', counties: [C('Sambia',20.9,54.65,'forest'), C('Pomesania',19.4,53.8,'forest'), C('Galindia',21.9,53.7,'wetlands')] },
    }},
    k_livonia: { name: 'Livonia', color: '#7aa06a', duchies: {
      d_livonia: { name: 'Livonia', cul: 'latvian', fai: 'baltic_pagan', counties: [C('Riga',24.6,56.9,'forest'), C('Courland',22.2,56.9,'forest'), C('Latgale',26.8,56.5,'forest')] },
      d_estonia: { name: 'Estonia', cul: 'estonian', fai: 'finnic_pagan', counties: [C('Reval',24.9,59.2,'forest'), C('Tartu',26.7,58.38,'forest')] },
    }},
  }},
  e_russia: { name: 'Russia', color: '#3f7f4f', kingdoms: {
    k_novgorod: { name: 'Novgorod', color: '#4d8c5c', duchies: {
      d_novgorod: { name: 'Novgorod', cul: 'russian', fai: 'orthodox', counties: [C('Novgorod',31.27,58.52,'forest'), C('Pskov',28.33,57.82,'forest'), C('Tver',35.9,56.86,'forest')] },
      d_beloozero: { name: 'Beloozero', cul: 'russian', fai: 'orthodox', counties: [C('Beloozero',37.8,60.0,'taiga'), C('Vologda',40.5,59.2,'taiga'), C('Ladoga',33.0,60.0,'taiga')] },
    }},
    k_rus: { name: 'Ruthenia', color: '#6aa070', duchies: {
      d_kiev: { name: 'Kiev', cul: 'russian', fai: 'orthodox', counties: [C('Kiev',30.52,50.45,'plains'), C('Pereyaslavl',32.0,50.07,'plains'), C('Poltava',34.55,49.6,'steppe')] },
      d_chernigov: { name: 'Chernigov', cul: 'russian', fai: 'orthodox', counties: [C('Chernigov',31.3,51.5,'forest'), C('Novgorod-Seversky',33.3,52.0,'forest'), C('Kursk',36.2,51.7,'plains')] },
      d_polotsk: { name: 'Polotsk', cul: 'russian', fai: 'orthodox', counties: [C('Polotsk',28.8,55.48,'forest'), C('Smolensk',32.05,54.78,'forest'), C('Minsk',27.56,53.9,'forest'), C('Turov',27.7,52.07,'wetlands')] },
      d_volhynia: { name: 'Galicia-Volhynia', cul: 'russian', fai: 'orthodox', counties: [C('Halych',24.5,49.3,'hills'), C('Volhynia',24.8,50.9,'forest'), C('Berestye',23.9,52.1,'forest')] },
    }},
    k_vladimir: { name: 'Vladimir', color: '#3f8a80', duchies: {
      d_vladimir: { name: 'Vladimir', cul: 'russian', fai: 'orthodox', counties: [C('Vladimir',40.4,56.13,'forest'), C('Moscow',37.62,55.75,'forest'), C('Rostov',39.4,57.4,'forest'), C('Kostroma',41.5,58.0,'forest')] },
      d_ryazan: { name: 'Ryazan', cul: 'russian', fai: 'orthodox', counties: [C('Ryazan',39.74,54.63,'plains'), C('Murom',42.04,55.58,'forest'), C('Voronezh',39.2,51.9,'forest')] },
      d_nizhny: { name: 'Nizhny Novgorod', cul: 'russian', fai: 'orthodox', counties: [C('Nizhny Novgorod',44.0,56.33,'forest'), C('Vyatka',48.5,58.4,'taiga')] },
    }},
    k_volga_bulgaria: { name: 'Volga Bulgaria', color: '#7a9a3a', duchies: {
      d_bulgar: { name: 'Bulgar', cul: 'bolghar', fai: 'sunni', counties: [C('Bolghar',49.06,54.98,'forest'), C('Zhukotin',50.5,56.3,'forest'), C('Samara',49.5,53.2,'steppe'), C('Mordvinia',45.0,54.2,'forest')] },
    }},
  }},
  e_steppe: { name: 'The Pontic Steppe', color: '#b58a4a', kingdoms: {
    k_khazaria: { name: 'Khazaria', color: '#c49a5a', duchies: {
      d_itil: { name: 'Itil', cul: 'khazar', fai: 'tengri', counties: [C('Itil',47.6,46.6,'steppe'), C('Sarai',45.8,48.6,'steppe'), C('Ukek',46.0,51.5,'steppe'), C('Kalmykia',45.0,46.5,'steppe')] },
      d_don: { name: 'Don', cul: 'khazar', fai: 'tengri', counties: [C('Sarkel',42.0,47.9,'steppe'), C('Tana',39.8,47.4,'steppe'), C('Tmutarakan',38.3,45.2,'steppe'), C('Donets',38.0,49.0,'steppe')] },
      d_crimea: { name: 'Crimea', cul: 'greek', fai: 'orthodox', counties: [C('Chersonesos',33.8,44.85,'hills'), C('Kaffa',35.0,45.15,'hills')] },
    }},
    k_cumania: { name: 'Cumania', color: '#d4b06a', duchies: {
      d_dnieper: { name: 'Dnieper', cul: 'cuman', fai: 'tengri', counties: [C('Oleshye',33.2,46.9,'steppe'), C('Budjak',29.5,46.3,'steppe'), C('Zaporozhia',35.5,47.6,'steppe')] },
      d_alania: { name: 'Alania', cul: 'alan', fai: 'orthodox', counties: [C('Alania',44.0,43.4,'mountains'), C('Kuban',40.5,45.0,'steppe'), C('Stavropol',42.5,45.3,'steppe')] },
    }},
  }},
  e_carpathia: { name: 'Carpathia', color: '#4a8a7a', kingdoms: {
    k_hungary: { name: 'Hungary', color: '#5aa08a', duchies: {
      d_pannonia: { name: 'Pannonia', cul: 'hungarian', fai: 'catholic', counties: [C('Esztergom',18.6,47.9,'farmland'), C('Buda',19.3,47.4,'plains'), C('Pécs',18.23,46.15,'plains')] },
      d_transylvania: { name: 'Transylvania', cul: 'hungarian', fai: 'catholic', counties: [C('Alba',23.58,46.07,'mountains'), C('Bihar',21.92,47.06,'plains'), C('Kolozs',23.6,47.0,'mountains')] },
      d_upper_hungary: { name: 'Upper Hungary', cul: 'hungarian', fai: 'catholic', counties: [C('Nitra',18.08,48.5,'hills'), C('Kassa',21.26,48.72,'mountains'), C('Eger',20.4,47.9,'hills')] },
      d_banat: { name: 'Banat', cul: 'hungarian', fai: 'catholic', counties: [C('Temesvár',21.23,45.75,'plains'), C('Szeged',20.15,46.4,'plains')] },
    }},
    k_croatia: { name: 'Croatia', color: '#4a6fa8', duchies: {
      d_croatia: { name: 'Croatia', cul: 'croatian', fai: 'catholic', counties: [C('Zagreb',15.98,45.81,'hills'), C('Knin',16.0,44.2,'mountains'), C('Slavonia',18.0,45.4,'plains')] },
      d_bosnia: { name: 'Bosnia', cul: 'croatian', fai: 'catholic', counties: [C('Bosnia',18.0,44.1,'mountains'), C('Hum',17.8,43.3,'mountains')] },
    }},
    k_wallachia: { name: 'Wallachia', color: '#c8a03a', duchies: {
      d_wallachia: { name: 'Wallachia', cul: 'vlach', fai: 'orthodox', counties: [C('Argeș',24.6,45.1,'hills'), C('Târgoviște',25.9,44.7,'plains'), C('Oltenia',23.6,44.4,'plains')] },
      d_moldavia: { name: 'Moldavia', cul: 'vlach', fai: 'orthodox', counties: [C('Suceava',26.0,47.65,'forest'), C('Iași',27.6,47.16,'plains'), C('Bessarabia',28.8,47.0,'steppe')] },
    }},
  }},
  e_byzantium: { name: 'Byzantium', color: '#8a2a7a', kingdoms: {
    k_byzantium: { name: 'Thrace', color: '#9a2f8c', duchies: {
      d_thrace: { name: 'Thrace', cul: 'greek', fai: 'orthodox', counties: [C('Constantinople',28.6,41.1,'farmland'), C('Adrianople',26.56,41.68,'plains'), C('Philippopolis',24.75,42.14,'plains')] },
      d_bithynia: { name: 'Bithynia', cul: 'greek', fai: 'orthodox', counties: [C('Nicaea',29.9,40.4,'hills'), C('Dorylaeum',30.52,39.6,'hills')] },
      d_lydia: { name: 'Thrakesion', cul: 'greek', fai: 'orthodox', counties: [C('Smyrna',27.5,38.42,'farmland'), C('Philadelphia',28.8,38.35,'hills'), C('Abydos',27.3,39.8,'hills')] },
    }},
    k_greece: { name: 'Greece', color: '#7a4ab0', duchies: {
      d_hellas: { name: 'Hellas', cul: 'greek', fai: 'orthodox', counties: [C('Athens',23.5,38.2,'hills'), C('Larissa',22.2,39.64,'plains')] },
      d_achaea: { name: 'Achaea', cul: 'greek', fai: 'orthodox', counties: [C('Corinth',22.3,37.8,'hills'), C('Lacedaemon',22.4,37.0,'mountains')] },
      d_epirus: { name: 'Epirus', cul: 'greek', fai: 'orthodox', counties: [C('Ioannina',20.85,39.67,'mountains'), C('Dyrrachion',19.8,41.2,'hills')] },
      d_crete: { name: 'Crete', cul: 'greek', fai: 'orthodox', counties: [C('Crete',24.8,35.25,'hills')] },
    }},
    k_thessalonica: { name: 'Thessalonica', color: '#b06ab0', duchies: {
      d_thessalonica: { name: 'Macedonia', cul: 'greek', fai: 'orthodox', counties: [C('Thessalonica',22.94,40.8,'farmland'), C('Ohrid',20.8,41.12,'mountains'), C('Skopje',21.43,42.0,'hills')] },
    }},
    k_bulgaria: { name: 'Bulgaria', color: '#4f9a5a', duchies: {
      d_moesia: { name: 'Moesia', cul: 'bulgarian', fai: 'orthodox', counties: [C('Tarnovo',25.63,43.08,'hills'), C('Preslav',26.82,43.16,'plains'), C('Vidin',22.88,43.99,'plains'), C('Dobruja',28.2,44.2,'plains')] },
      d_serdica: { name: 'Serdica', cul: 'bulgarian', fai: 'orthodox', counties: [C('Sofia',23.32,42.7,'hills'), C('Varna',27.6,43.21,'plains')] },
    }},
    k_serbia: { name: 'Serbia', color: '#a03a3a', duchies: {
      d_rascia: { name: 'Rascia', cul: 'serbian', fai: 'orthodox', counties: [C('Ras',20.5,43.14,'mountains'), C('Belgrade',20.46,44.82,'plains'), C('Niš',21.9,43.32,'hills')] },
      d_zeta: { name: 'Duklja', cul: 'serbian', fai: 'orthodox', counties: [C('Zeta',19.26,42.44,'mountains')] },
    }},
    k_anatolia: { name: 'Anatolia', color: '#b04a6a', duchies: {
      d_lycaonia: { name: 'Anatolikon', cul: 'greek', fai: 'orthodox', counties: [C('Iconium',32.48,37.87,'drylands'), C('Attalia',30.7,37.1,'hills'), C('Amorion',31.3,38.9,'drylands')] },
      d_cappadocia: { name: 'Cappadocia', cul: 'greek', fai: 'orthodox', counties: [C('Caesarea',35.48,38.72,'hills'), C('Ancyra',32.85,39.93,'drylands'), C('Sebasteia',37.02,39.75,'hills')] },
      d_paphlagonia: { name: 'Paphlagonia', cul: 'greek', fai: 'orthodox', counties: [C('Sinope',34.6,41.7,'hills'), C('Amaseia',36.0,40.65,'hills'), C('Kastamon',33.2,41.2,'forest')] },
      d_cilicia: { name: 'Cilicia', cul: 'armenian', fai: 'orthodox', counties: [C('Tarsus',34.9,37.1,'plains'), C('Melitene',38.3,38.35,'mountains')] },
      d_cyprus: { name: 'Cyprus', cul: 'greek', fai: 'orthodox', counties: [C('Cyprus',33.36,35.1,'hills')] },
    }},
  }},
  e_persia: { name: 'Persia', color: '#3a8a8a', kingdoms: {
    k_armenia: { name: 'Armenia', color: '#c86a3a', duchies: {
      d_armenia: { name: 'Armenia', cul: 'armenian', fai: 'orthodox', counties: [C('Ani',43.57,40.5,'mountains'), C('Vaspurakan',43.8,38.2,'mountains'), C('Dvin',44.7,40.0,'mountains')] },
      d_chaldia: { name: 'Chaldia', cul: 'greek', fai: 'orthodox', counties: [C('Trebizond',39.6,40.75,'mountains'), C('Theodosiopolis',41.27,39.9,'mountains')] },
    }},
    k_georgia: { name: 'Georgia', color: '#c8505a', duchies: {
      d_kartli: { name: 'Kartli', cul: 'georgian', fai: 'orthodox', counties: [C('Tbilisi',44.8,41.7,'hills'), C('Kutaisi',42.7,42.27,'hills'), C('Abkhazia',41.5,43.0,'mountains')] },
    }},
    k_shirvan: { name: 'Shirvan', color: '#4a9a8a', duchies: {
      d_shirvan: { name: 'Shirvan', cul: 'persian', fai: 'sunni', counties: [C('Shamakhi',48.4,40.63,'hills'), C('Derbent',47.6,42.0,'hills'), C('Ganja',46.36,40.68,'hills')] },
      d_azerbaijan: { name: 'Azerbaijan', cul: 'persian', fai: 'sunni', counties: [C('Tabriz',46.29,38.08,'mountains'), C('Ardabil',48.0,38.25,'hills'), C('Gilan',49.3,37.0,'forest')] },
    }},
    k_persia: { name: 'Persia', color: '#2f7a7a', duchies: {
      d_jibal: { name: 'Jibal', cul: 'persian', fai: 'shia', counties: [C('Hamadan',48.5,34.8,'mountains'), C('Kermanshah',47.07,34.31,'mountains'), C('Qazvin',49.5,36.27,'mountains')] },
      d_khuzestan: { name: 'Khuzestan', cul: 'persian', fai: 'shia', counties: [C('Ahvaz',48.67,31.32,'floodplains'), C('Lorestan',48.3,33.3,'mountains')] },
    }},
  }},
  e_arabia: { name: 'Arabia', color: '#2f8a3f', kingdoms: {
    k_syria: { name: 'Syria', color: '#3a9a4a', duchies: {
      d_aleppo: { name: 'Aleppo', cul: 'levantine', fai: 'sunni', counties: [C('Aleppo',37.16,36.2,'drylands'), C('Antioch',36.3,36.2,'hills'), C('Edessa',38.79,37.15,'drylands')] },
      d_damascus: { name: 'Damascus', cul: 'levantine', fai: 'sunni', counties: [C('Damascus',36.29,33.51,'drylands'), C('Homs',36.9,34.73,'drylands'), C('Tripoli',36.0,34.3,'hills'), C('Palmyra',38.27,34.55,'desert')] },
    }},
    k_jerusalem: { name: 'Jerusalem', color: '#e0d090', duchies: {
      d_jerusalem: { name: 'Jerusalem', cul: 'levantine', fai: 'sunni', counties: [C('Jerusalem',35.21,31.77,'hills'), C('Acre',35.2,32.9,'plains'), C('Ascalon',34.7,31.55,'plains')] },
      d_oultrejordain: { name: 'Oultrejordain', cul: 'bedouin', fai: 'sunni', counties: [C('Kerak',35.8,31.1,'desert'), C('Amman',36.0,32.1,'drylands')] },
    }},
    k_jazira: { name: 'Jazira', color: '#7aa04a', duchies: {
      d_mosul: { name: 'Mosul', cul: 'levantine', fai: 'sunni', counties: [C('Mosul',43.13,36.34,'drylands'), C('Amid',40.22,37.91,'hills'), C('Raqqa',39.0,35.95,'drylands'), C('Hakkari',43.7,37.3,'mountains')] },
    }},
    k_iraq: { name: 'Iraq', color: '#4a7a3a', duchies: {
      d_baghdad: { name: 'Baghdad', cul: 'iraqi', fai: 'sunni', counties: [C('Baghdad',44.36,33.31,'floodplains'), C('Samarra',43.88,34.4,'floodplains'), C('Wasit',45.86,32.4,'floodplains')] },
      d_basra: { name: 'Basra', cul: 'iraqi', fai: 'shia', counties: [C('Kufa',44.4,31.9,'floodplains'), C('Basra',47.6,30.6,'wetlands'), C('Hit',42.6,33.7,'desert')] },
    }},
    k_egypt: { name: 'Egypt', color: '#d6c04a', duchies: {
      d_alexandria: { name: 'Alexandria', cul: 'egyptian', fai: 'shia', counties: [C('Alexandria',29.8,30.9,'floodplains'), C('Damietta',31.6,31.2,'floodplains')] },
      d_cairo: { name: 'Cairo', cul: 'egyptian', fai: 'shia', counties: [C('Cairo',31.24,30.04,'floodplains'), C('Faiyum',30.84,29.31,'floodplains'), C('Minya',30.75,28.3,'floodplains'), C('Sinai',33.8,30.4,'desert')] },
    }},
  }},
  e_maghreb: { name: 'Maghreb', color: '#3a7a5a', kingdoms: {
    k_ifriqiya: { name: 'Ifriqiya', color: '#4a9a6a', duchies: {
      d_tunis: { name: 'Tunis', cul: 'maghrebi', fai: 'sunni', counties: [C('Tunis',10.0,36.7,'farmland'), C('Kairouan',10.1,35.68,'drylands'), C('Gabès',9.6,33.88,'desert')] },
      d_tripolitania: { name: 'Tripolitania', cul: 'maghrebi', fai: 'sunni', counties: [C('Tarabulus',13.18,32.6,'drylands'), C('Sirte',16.6,31.0,'desert')] },
      d_cyrenaica: { name: 'Cyrenaica', cul: 'maghrebi', fai: 'sunni', counties: [C('Barqa',20.6,32.3,'drylands'), C('Tobruk',23.8,31.8,'desert')] },
    }},
    k_algeria: { name: 'Mauretania', color: '#6a9a4a', duchies: {
      d_constantine: { name: 'Constantine', cul: 'berber', fai: 'sunni', counties: [C('Constantine',6.61,36.2,'hills'), C('Béjaïa',5.0,36.5,'hills'), C('Biskra',5.73,34.85,'desert')] },
      d_tlemcen: { name: 'Tlemcen', cul: 'berber', fai: 'sunni', counties: [C('Algiers',3.06,36.5,'hills'), C('Tlemcen',-1.31,34.88,'hills'), C('Tahert',1.32,35.37,'drylands')] },
    }},
    k_morocco: { name: 'Morocco', color: '#a03a4a', duchies: {
      d_fes: { name: 'Fes', cul: 'berber', fai: 'sunni', counties: [C('Fez',-5.0,34.03,'hills'), C('Tangier',-5.6,35.5,'hills'), C('Taza',-3.0,34.3,'mountains')] },
      d_marrakesh: { name: 'Marrakesh', cul: 'berber', fai: 'sunni', counties: [C('Marrakesh',-7.98,31.63,'drylands'), C('Salé',-6.6,33.9,'plains'), C('Sus',-9.0,30.4,'drylands'), C('Sijilmasa',-4.3,31.3,'desert'), C('Tadla',-6.4,32.5,'mountains')] },
    }},
  }},
};

export const TERRAIN = {
  plains:     { name: 'Plains',      color: '#b9c27a', move: 1.0, def: 0,   tax: 1.0, levy: 1.0 },
  farmland:   { name: 'Farmlands',   color: '#c8c86a', move: 1.0, def: 0,   tax: 1.25, levy: 1.15 },
  hills:      { name: 'Hills',       color: '#a8a06a', move: 0.8, def: 0.15, tax: 0.95, levy: 1.0 },
  mountains:  { name: 'Mountains',   color: '#8f8a80', move: 0.55, def: 0.35, tax: 0.7, levy: 0.8 },
  forest:     { name: 'Forest',      color: '#5f8a4a', move: 0.75, def: 0.15, tax: 0.9, levy: 0.95 },
  taiga:      { name: 'Taiga',       color: '#5a7a5a', move: 0.65, def: 0.15, tax: 0.6, levy: 0.7 },
  wetlands:   { name: 'Wetlands',    color: '#6a9a8a', move: 0.6, def: 0.2, tax: 0.85, levy: 0.85 },
  steppe:     { name: 'Steppe',      color: '#c8b87a', move: 1.15, def: -0.05, tax: 0.6, levy: 1.2 },
  drylands:   { name: 'Drylands',    color: '#d0b07a', move: 0.9, def: 0,   tax: 0.8, levy: 0.85 },
  desert:     { name: 'Desert',      color: '#e0c890', move: 0.6, def: 0.05, tax: 0.45, levy: 0.5 },
  floodplains:{ name: 'Floodplains', color: '#9ac06a', move: 0.9, def: -0.05, tax: 1.4, levy: 1.2 },
};

export function slug(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}
