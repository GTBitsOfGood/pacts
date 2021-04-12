import React, { useState } from 'react';
import GoogleMapReact from 'google-map-react';
import { GOOGLE_API_KEY } from '../../config/keys';
import mapConfig from '../about/mapConfig';
import firebase from "firebase";
import {
    withFirestore, isEmpty, isLoaded, withFirebase,
  } from 'react-redux-firebase';
import Button from 'react-bootstrap/Button';
import { Col, Container, Row, Card} from 'react-bootstrap';
import Form from 'react-bootstrap/Form';
import { SketchPicker } from 'react-color';
import ImageModal from '../dashboard/ImageModal';
import Dropzone from 'react-dropzone';


const defaultLat = 33.7756;
const defaultLng = -84.3963;
const defaultZoom = 5;
const defaultCoords = { lat: defaultLat, lng: defaultLng };

var data = {
    latitude: defaultLat,
    longitude: defaultLng,
    zoom: defaultZoom,
    center: defaultCoords,
}

function MapPicker(props) {
    const [isLoading, setIsLoading] = useState(true);
    const [coords, setCoords] = useState(data.center);
    const [magnification, setMagnification] = useState(data.zoom);
    const [customColorDesired, setCustomColorDesired] = useState(false);
    const [primaryColor, setPrimaryColor] = useState('#226DFF');
    const [secondaryColor, setSecondaryColor] = useState('#0A1D7C');
    const [visibility, setVisibility] = useState(false);
    const teamName = props.team.name;
    const [uploaded, setUploaded] = useState(false);
    const [image, setImage] = useState(null);
    const[imageURL, setImageURL] = useState(null);

    const handleDrop = (img) => {
        setImage(img[0]);
        setUploaded(true);
    }
    
    async function saveDataToFirebase() {
        await firebase.firestore().collection('teams').doc(teamName).update({latitude: coords.lat});
        await firebase.firestore().collection('teams').doc(teamName).update({longitude: coords.lng});
        await firebase.firestore().collection('teams').doc(teamName).update({zoom: magnification});
        await firebase.firestore().collection('teams').doc(teamName).update({primaryColor: primaryColor});
        await firebase.firestore().collection('teams').doc(teamName).update({secondaryColor: secondaryColor});
    }
    
    const mapOptions = {
        styles: mapConfig,
    }
    
    function verifyColor(color) {
        setPrimaryColor(color.hex);
    }

    const changeCenterAndZoom = ({center, zoom}) => {
        setCoords(center);
        setMagnification(zoom);
    }

    return (
        <div style={{ height: '100%', width: '100%'}}>
            <div style={{backgroundColor: 'rgb(255, 255, 255)', marginLeft: '150px', padding: '5px'}}>
                <Container>
                    <Row style={{paddingBottom: '20px', marginTop: '1rem', marginBottom: '1rem', border: '0', borderBottom: '1px solid rgba(0, 0, 0, 0.1)'}}>
                        <Col xs={10}>
                            <h3 style={{fontWeight: 'bold'}}>Personalize your map</h3>
                        </Col>
                        <Col>
                        <Button
                            className="saveButton"
                            variant="primary"
                            size="sm"
                            onClick={saveDataToFirebase}>
                            Save
                        </Button>
                        </Col>
                    </Row>
                    <Form style={{paddingBottom: '30px'}}>
                        <Form.Group>
                            <Form.Label>Organization Name</Form.Label>
                            <Form.Control size="sm" value={teamName} type="text" readOnly/>
                        </Form.Group>
                        <Row>
                            <Col xs={9}>
                                <Form.Label>Mapscout URL</Form.Label>
                                <Form.Control size="sm" value={teamName} type="text" readOnly/>
                            </Col>
                            <Col> 
                                <div className="upload-restrict">
                                    {!uploaded && 
                                    (<Dropzone accept="image/*" onDrop={handleDrop}>
                                        {({ getRootProps, getInputProps }) => (
                                        <div {...getRootProps({ className: "dropzone-mappicker" })}>
                                            <input {...getInputProps()} />
                                            <p style={{height: "100px"}}>Upload Logo Image</p>
                                        </div>
                                        )}
                                    </Dropzone>)
                                    }
                                    {uploaded && (
                                        <div className="imageModalSave">
                                            <Row noGutters={true}>
                                                <Col style={{marginRight: "40px"}}>
                                                    <img src={URL.createObjectURL(image)} className="image-upload" />
                                                </Col>
                                                <Col>
                                                    <Button className="cancelButton btn btn-danger" onClick={() => setUploaded(false)}>Cancel</Button>
                                                </Col>
                                            </Row>
                                        </div>
                                    )
                                    }
                                </div>
                            </Col>
                        </Row>
                    </Form>
                    <Row className="align-items">
                        <Col xs={5}>
                            <p>Color</p>
                            <Row className="align-items">
                                <Col xs={2}>
                                    <Card style={{ backgroundColor: primaryColor, width: '3rem', height: '3rem'}}>
                                    </Card>
                                </Col>
                                <Col xs={2}>
                                    <Card style={{ backgroundColor: secondaryColor, width: '3rem', height: '3rem'}}>
                                    </Card>
                                </Col>
                                <Col>
                                <SketchPicker
                                    color={primaryColor}
                                    onChange={verifyColor}
                                />
                                </Col>
                                
                            </Row>
                        </Col>
                        <Col>
                            <p>Choose the default location of your map</p>
                            <Row className="align-items" style={{height: "40vh", marginLeft: "auto"}}>
                                <GoogleMapReact
                                        bootstrapURLKeys={{
                                            key: GOOGLE_API_KEY,
                                        }}
                                        zoom={magnification}
                                        center={coords}
                                        onChange={({center, zoom}) => changeCenterAndZoom({center, zoom})}
                                        options={mapOptions}
                                    ></GoogleMapReact>
                            </Row> 
                        </Col>
                    </Row>
                </Container>
            </div>
        </div>
    )
}

export default withFirebase(MapPicker);