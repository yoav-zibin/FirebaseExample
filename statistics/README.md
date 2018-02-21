# Firebase Statistics & File Conversion

This module using the [Firebase Admin SDK](https://firebase.google.com/docs/reference/admin/) to read image data/paths from the universalgamemaker Firebase Database, perform image resizing/compression on images in Firebase Cloud Storage, then create statistics based on the newly generated images.

## Setup:
After running `npm install`, download your service account credentials and replace this line with the path to your own credential file:

```
const serviceAccount = require("./<YOUR CREDENTIALS HERE>");

```  
## Usage

Depending on what you want to do with the stats, uncomment the functions called in `main()`

```
function main(){
  // downloadDatabase();
  // downloadImages();
  // getGameData();
  // generateStats();
  // admin.app().delete();
}
```

Note that `admin.app().delete()` immediately closes the connection to Firebase, so if you are calling async function(s), keep this line uncommented and manually quit out of the program when the function(s) finish.

Look below for explanations of each function.

When ready, run `npm start`.

## Functions

##### downloadDatabase
This function downloads the entire Firebases realtime database, parses the resulting JSON, and saves it locally to `database.json`.

##### downloadImages
This function downloads all images in Firebase storage and saves them locally to `./images`

##### getGameData
Since all the images from `downloadImages` are random filenames, we need to associate the files with their respective game. This function reads `database.json` and creates a new JSON file called `image_data.json` where each object is a game listing its board and non-board file names. For example:

```
"3 Man Chess": {
  "board": "images/-KuZltt2rBvN2NZvCKGw.png",
  "nonboard": [
    "images/-KuXrNf2f2k1CSCDnx7-.png",
    "images/-KuXrNf2f2k1CSCDnx7-.png",
    "images/-KuXrNf2f2k1CSCDnx7-.png",
    "images/-KuXrNf2f2k1CSCDnx7-.png",
    "images/-KuXrNf2f2k1CSCDnx7-.png",
    "images/-KuXrNf2f2k1CSCDnx7-.png",
    "images/-KuXrNf2f2k1CSCDnx7-.png",
    ...
    ]
  }
```

This format makes it easier to resize entire game files together to create the statistics.

##### generateStats
This function iterates through the file generated in `getGameData` and batch converts images. For each game with the name `gameName`, this function:

* Compresses the **board** image to JPG and saves it to the directory `./images/boardToJPG/gameName/`. If the board image is already a JPG, it's left alone.  

* Converts all **non-board** images to quality=70 and saves to directory `./images/q70/uncompressed/gameName/`

* Converts all **non-board** images to quality=50 and saves to directory `./images/q50/uncompressed/gameName/`

* Compresses all **non-board** images to JPGs with quality=70 and saves to directory `./images/q70/compressed/gameName/`

* Compresses all **non-board** images to JPGs with quality=50 and saves to directory `./images/q50/compressed/gameName/`

After all file conversions are completed, the function then iterates through the newly generated files for each game and sums together the file sizes for the various different compressions/conversions. It then writes all of this information into `image_stats.json`. Here is part of the file:

```
{
  "0": {
    "game": "3 Man Chess",
    "original": "1 MB",
    "q70_uncompressed": "355 KB",
    "q50_uncompressed": "355 KB",
    "q70_compressed": "347 KB",
    "q50_compressed": "345 KB"
  },
  "1": {
    "game": "Alquerque",
    "original": "212 KB",
    "q70_uncompressed": "294 KB",
    "q50_uncompressed": "294 KB",
    "q70_compressed": "147 KB",
    "q50_compressed": "140 KB"
  }, ...
}

```
