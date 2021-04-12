import React, { useState } from "react";
import { compose } from 'redux'
import { connect } from 'react-redux'
import { withFirestore } from 'react-redux-firebase';
import { Store } from "reducers/types";
import MapPicker from "./mappicker"

const defaultLat = 33.7756;
const defaultLng = -84.3963;
const defaultZoom = 2;
const defaultCoords = { lat: defaultLat, lng: defaultLng };

function Settings({ firebase, team }) {

    return (
        <div>
            <MapPicker
            center={defaultCoords}
            zoom={defaultZoom}
            team={team}
            />
        </div>
    )
}

const mapStateToProps = (state: Store) => ({
    team: state.item.team,
  });

export default compose<any>(
    withFirestore,
    connect(
      mapStateToProps,
      {},
    ),
)(Settings)
