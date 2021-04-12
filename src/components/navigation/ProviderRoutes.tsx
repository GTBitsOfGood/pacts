import React, { useState, useEffect, useMemo, Component, ReactType } from 'react';
import { Route, Switch, Redirect } from 'react-router-dom';
import { compose } from 'redux';
import { connect } from 'react-redux';
import {
  withFirestore, isEmpty, isLoaded, withFirebase,
} from 'react-redux-firebase';
import NavBar from './NavBar';
import Auth from '../auth/Auth';
import Dashboard from '../dashboard';
import settings from '../settings';
import AddProvider from '../dashboard/AddProvider';
import PasswordForgetForm from '../auth/PasswordForget';
import Template from '../template';
import NotFound from '../NotFound';
import SentryWrapper from '../wrappers/SentryWrapper';
import Chat from '../chat';
import { selectTeam } from '../../functions/reduxActions';
import useWindowSize from '../../functions/useWindowSize';
import Modal from "react-bootstrap/Modal";

import {
  providerRoute, formRoute, authRoute, pwdRoute, templateRoute, chatRoute, settingsRoute 
} from '../../routes/pathnames';

const classNames = require("classnames");

type PrivateRouteProps = {
  exact?: boolean,
  path: string,
  component: ReactType,
}

function DashboardContent({ isAuth, auth }) {
  const PrivateRoute = ({ component: Component }: PrivateRouteProps) => (
    <Route render={(prps) => {
      if (isAuth) {
        return (
          <Redirect to={{
            pathname: authRoute,
            state: { from: prps.location },
          }}
          />
        );
      }
      return <Component {...prps} />;
    }}
    />
  );

  return useMemo(() => (
    <div className="dashboard-content">
      <Switch>
        <PrivateRoute
          exact
          path={providerRoute}
          component={Dashboard}
        />
        <PrivateRoute
          path={formRoute}
          component={AddProvider}
        />
        <PrivateRoute
          path={templateRoute}
          component={Template}
        />
        <PrivateRoute
          path={chatRoute}
          component={Chat}
        />
        <PrivateRoute
          path={settingsRoute}
          component={settings}
        />
      </Switch>
    </div>
  ), [auth]);
}

const ProviderRoutes = (props) => {
  const [isLoading, setIsLoading] = useState(true);
  const { width } = useWindowSize();
  const [alerted, setAlerted] = useState(false);

  async function fetchTeam() {
    const { firestore, team, firebaseAuth } = props;
    setIsLoading(true);
    if ((!team || !team.name) && typeof firebaseAuth.auth.uid === 'string') {
      await firestore
        .collection('users')
        .where('UID', '==', firebaseAuth.auth.uid)
        .get()
        .then((querySnapshot) => {
          querySnapshot.forEach(async (doc) => {
            const docData = doc.data();
            await firestore
              .collection('teams')
              .where('name', '==', docData.team)
              .get()
              .then((querySnapshot2) => {
                querySnapshot2.forEach((doc2) => {
                  const docData2 = doc2.data();
                  props.selectTeam(docData2);
                });
              });
          });
        });
      setIsLoading(false);
    } else if (isLoaded(firebaseAuth.auth) && firebaseAuth.auth.uid === undefined) {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchTeam();
  }, []);

  useEffect(() => {
    fetchTeam();
  }, [props.firebaseAuth.auth]);

  useEffect(() => {
    // TODO: Define a constant for mobile width
    width > 768 && setAlerted(false);
  }, [width]);

  const logout = () => {
    props.firebase.logout()
      .then(() => {
        props.selectTeam('');
        props.history.push(authRoute);
      })
      .catch((error) => {
        console.log(error);
      });
  };

  if (isLoading || !isLoaded(props.firebaseAuth.auth)) {
    return (
      <div className="spinner-wrap">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div style={{position: 'relative'}}>
      {width <= 768 ? (
        <Modal
          show={!alerted}
          onHide={() => setAlerted(true)}
          scrollable
        >
          <Modal.Header closeButton className="bg-warning">
            WARNING: The Admin Dashboard is not optimized for small screens
          </Modal.Header>
        </Modal>
      ) : (<></>)}
      <SentryWrapper>
        <Switch>
          <Route path={providerRoute}>
            <>
              <NavBar
                team={props.team}
                logout={logout}
              />
              <DashboardContent
                isAuth={isEmpty(props.firebaseAuth.auth)}
                auth={props.firebaseAuth}
              />
            </>
          </Route>
          <Route
            exact
            path={authRoute}
            component={Auth}
          />
          <Route
            path={pwdRoute}
            component={PasswordForgetForm}
          />
          <Route exact path="*" component={NotFound} />
        </Switch>
      </SentryWrapper>
    </div>
  );
};

function areEqual(prevProps, nextProps) {
  return prevProps.location === nextProps.location && prevProps.team === nextProps.team;
}

const mapDispatchToProps = {
  selectTeam,
};

const mapStateToProps = (state) => ({
  firebaseAuth: state.firebase,
  team: state.item.team,
});

// Need auth property to check if logged in or loading
export default compose<any>(
  withFirestore,
  withFirebase,
  connect(mapStateToProps, mapDispatchToProps),
)(React.memo(ProviderRoutes, areEqual));
