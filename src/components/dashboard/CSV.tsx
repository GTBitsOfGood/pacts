import { connect } from 'react-redux';
import { compose } from 'redux';
import { withFirestore } from 'react-redux-firebase';
import React,{Component} from 'react';
import { jsonToCSV } from 'react-papaparse';
import Button from 'react-bootstrap/Button';
import DropdownButton from 'react-bootstrap/DropdownButton';
import { CategoryDocProps } from 'types/firestore';
import Dropdown from 'react-bootstrap/Dropdown';
import Modal from 'react-bootstrap/Modal';
import {CSVReader} from 'react-papaparse';
import { createDocumentRegistry, createKeywordTypeNode } from 'typescript';

const ExportCSV = (props) => {

  const defaultItem = {
    facilityName: '',
    address: [],
    description: '',
    buildingNum: [0],
    childcare: [false],
    epic: [false],
    hours: {},
    links: {},
    notes: [],
    phoneNum: [],
    latitude: 0,
    longitude: 0,
    website: [],
    image: 'modalimage.png',
    imageURL: null,
  };


  const [show, setShow] = React.useState(false);
  const [importProviders, setImportProviders] = React.useState(null);
  const handleClose = () => setShow(false);
  const handleShow = () => setShow(true);
  const columns = ["address", "buildingNum", "description", "facilityName", "hours", "id",
  "image", "imageURL", "latitude", "longitude", "phoneNum", "website"];

  props.categories.forEach((category: CategoryDocProps) => {
    columns.push(category.id);
  });

  const importConfig = {
    quotes: true, //or array of booleans
    quoteChar: '"',
    escapeChar: '"',
    delimiter: ",",
    header: true,
    newline: "\n",
    skipEmptyLines: 'false', //or 'greedy',
    columns: columns
  }

  const exportConfig = {
    quotes: true, //or array of booleans
    quoteChar: '"',
    escapeChar: '"',
    delimiter: ",",
    header: true,
    newline: "\n",
    skipEmptyLines: 'false', //or 'greedy',
    columns: columns //or array of strings
  }

  function arrayToJson() {
    //Make a providers temp array to edit
    let providersCopy : {team: string, hours: string}[] = Array.from(props.providers);

    //iterates through providers array and converts each provider to a JSON object
    for (let index = 0; index < props.providers.length; index++) {
      providersCopy[index].hours = JSON.stringify(providersCopy[index].hours);  //stringify the hour property
      delete providersCopy[index].team;   //deletes the team property from each provider
    }

    return providersCopy;
  }

  function handleExport() {
    const results = jsonToCSV(arrayToJson(), exportConfig);
    var dataString = results.split(/\r?\n/);
    var dataArray = [];
    for(var i =0; i < dataString.length; i++){
      var subrray = [dataString[i]];
      dataArray.push(subrray);
    }
    let csvContent = "data:text/csv;charset=utf-8,";

    dataArray.forEach(function(rowArray) {
        let row = rowArray.join(",");
        csvContent += row + "\r\n";
    });

    var encodedUri = encodeURI(csvContent);
    window.open(encodedUri);
  }

  async function handleDrop(data) {
    let oldProviders : {id: string}[] = Array.from(props.providers);
    let oldCategories: {id: string}[] = Array.from(props.categories);
    console.log("older categories", oldCategories);
    console.log("older Providers", oldProviders);
    console.log('---------------------------')
    console.log("data", data)
    console.log('---------------------------')

    let mergedProviders = data.slice();
    let isDifferent = false;
    for(let i = 0; i < oldProviders.length; i++) {
      for (let j = 0; j < mergedProviders.length; j++) {
        if (oldProviders[i] != undefined || mergedProviders[j] != undefined ) {
          continue;
        } else if (oldProviders[i].id.localeCompare(mergedProviders[j].data.id) == 0) { //non-match in ID
          isDifferent = true;
        }
      }
      if (isDifferent) {
        mergedProviders.push(oldProviders[i]);
      }
      isDifferent = false;
    }

    for (let i = 0; i < mergedProviders.length; i++) {
      mergedProviders[i].data['team'] = props.team.name;
      for (const property in mergedProviders[i].data) {
        const trimmedProperty = property.trim();
        if (property != trimmedProperty) {
          mergedProviders[i].data[trimmedProperty] = JSON.parse(JSON.stringify(mergedProviders[i].data[property]));
          delete mergedProviders[i].data[property]
        }
        if (trimmedProperty in defaultItem && Array.isArray(defaultItem[trimmedProperty])) { // Handle default array categories
          mergedProviders[i].data[trimmedProperty] = mergedProviders[i].data[trimmedProperty] ? [mergedProviders[i].data[trimmedProperty]] : []
        } else if (trimmedProperty in defaultItem && typeof defaultItem[trimmedProperty] === "number") { // Handle default number categories
          mergedProviders[i].data[trimmedProperty] = Number(mergedProviders[i].data[trimmedProperty])
        } else if (trimmedProperty in defaultItem && (trimmedProperty === "hours" || trimmedProperty === "links")) { // Handle default object categories
          mergedProviders[i].data[trimmedProperty] = JSON.parse(mergedProviders[i].data[trimmedProperty]);
        } else if (columns.includes(trimmedProperty) && !(trimmedProperty in defaultItem)) { // Handle custom array categories
          const doc = await props.firestore.collection('categories').doc(trimmedProperty).get();
          console.log(columns);
          if (doc.data()) {
            const selectType = doc.data()['select_type'];
            if (selectType === 2) {
              mergedProviders[i].data[trimmedProperty] = mergedProviders[i].data[trimmedProperty] ? mergedProviders[i].data[trimmedProperty].split(',') : []
            }
          } else {
            alert(`Warning: You are uploading a CSV where the ${trimmedProperty} column is not defined`);
          }
        }
      }
    }

    var columnArr= [];
    for(let i = 0; i < data.slice().length; i++){
      let entry = data.slice()[i].data;
      for(var column in entry) {
        let col = column; //column in csv
        columnArr.push(col);
        let val = entry[column]; // data corresponding the column
        let containsName = false;
        for(let j =0; j < oldCategories.length; j++){
          if(oldCategories[j]["id"]=== col){
            containsName = true;
            let options =oldCategories[j]["options"];
            if(val != ""){
              let ele = {label: val, value: val};
              // push ele to option array
              options.push(ele);
            }
            break;
          }
        }
        console.log(containsName)
        if(!containsName){
          // create a new object and push it to mergedCategories
          var arr= [];
          if(val != ""){
            let ele = {label: val, value: val};
            arr.push(ele)
          }
          // manually set priority and select_type to 0
          let newCatategories = {
            id: col,
            name: col,
            active: true,
            options:arr,
            priority: columnArr.length-1,
            select_type: 2
          };

          oldCategories.push(newCatategories);
        }
        // if object does not contain in the csv column, set active to false and set priority to undefined
        for(let j =0; j < oldCategories.length; j++){
          if(!columnArr.includes(oldCategories[j]["id"])){
            oldCategories[j]["active"] = false;
            oldCategories[j]["priority"] = undefined;
          }
        }
      }
    }
    setImportProviders(mergedProviders);
  }

  function handleRemoveFile() {
    setImportProviders(null);
  }

  async function handleSubmit() {
    if (importProviders) {
      let promises = [];
      importProviders.forEach(async (provider) => {
        await props.firestore.collection('providers').doc(provider.data.facilityName).set(provider.data);
      });
      await Promise.all(promises);
      handleClose();
    }
  }

  return (
    <>
      <DropdownButton id="dropdown-split-variants-secondary" variant="secondary" title="CSV">
        <Dropdown.Item onClick={handleShow}>Import</Dropdown.Item>
        <Dropdown.Item onClick={handleExport}>Export</Dropdown.Item>
      </DropdownButton>
      <Modal
        size="lg"
        show={show}
        onHide={handleClose}
      >
        <Modal.Header closeButton>
          <Modal.Title>Import CSV</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <CSVReader
            onDrop={handleDrop}
            config={importConfig}
            addRemoveButton
            onRemoveFile={handleRemoveFile}
          >
            <span>Drop CSV file here or click to upload 1.</span>
          </CSVReader>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleClose}>
            Exit
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            Upload
          </Button>
        </Modal.Footer>
      </Modal>
    </>
  );
  }

export default compose<any>(
  withFirestore,
  connect((state) => ({
    firebase: state.firebase,
    team: state.item.team,
  })),
)(ExportCSV)