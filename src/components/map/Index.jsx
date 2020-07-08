import React, {
  useState, useEffect, useRef,
} from 'react';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Dropdown from 'react-bootstrap/Dropdown';
import { compose } from 'redux';
import { connect } from 'react-redux';
import { withFirestore, isEmpty, isLoaded } from 'react-redux-firebase';
import Modal from 'react-bootstrap/Modal';
import {
  FaTimesCircle, FaMap,
} from 'react-icons/fa';
import ProviderInfo from '../ProviderInfo';
import ProviderInfoMobile from '../ProviderInfoMobile';
import GoogleMap from './GoogleMap';
import ProviderCell from './ProviderCell';
import localizationStrings from '../../utils/Localization';
import GOOGLE_API_KEY from '../../config/keys';

const debounce = require('lodash/debounce');
const classNames = require('classnames');

const FILTER_CUTOFF = 5;

const getWidth = () => window.innerWidth
    || document.documentElement.clientWidth
    || document.body.clientWidth;

const Index = (props) => {
  const [providers, setProviders] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [moreFilter, setMoreFilter] = useState(false);
  const [listView, setListView] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeProviders, setActiveProviders] = useState([]);
  const [tempProviders, setTempProviders] = useState([]);
  const [zipProviders, setZipProviders] = useState([]);
  const [searchName, setSearchName] = useState('');
  const [searchZip, setSearchZip] = useState(null);
  const [name, setName] = useState(null);
  const [markers, setMarkers] = useState(null);
  const [currmarker, setCurrmarker] = useState(-1);
  const [point, setPoint] = useState(true);
  const [distances, setDistances] = useState({});
  const [prevSearchLen, setPrevSearchLen] = useState(0);

  const [primaryColor, setPrimaryColor] = useState('');
  const [secondaryColor, setSecondaryColor] = useState('');
  const [defaultLat, setDefaultLat] = useState(0);
  const [defaultLong, setDefaultLong] = useState(0);
  const [defaultZoom, setDefaultZoom] = useState(1);

  const [filtersState, setFiltersState] = useState({});
  const [filtersData, setFiltersData] = useState({});
  const [categories, setCategories] = useState([]);

  // set filterIds from firestore in useeffect
  useEffect(() => {
    document.title = getTeam().toUpperCase();
    setIsLoading(true);
    fetchData().then((r) => {
      setTempProviders(providers);
    });
  }, []);

  useEffect(() => {
    if (isLoaded(providers)) {
      setTempProviders(providers);
    }
  }, [providers]);

  function getTeam() {
    return props.location.pathname.replace('/', '');
  }

  async function fetchData() {
    const { firestore } = props;
    const collections = firestore.collection('categories');
    const data = {};
    const filtersObj = {};
    const cat = await collections
      .where('active', '==', true)
      .where('team', '==', getTeam())
      .get()
      .then((querySnapshot) => {
        const arr = [];
        querySnapshot.forEach((doc) => {
          const docData = doc.data();
          arr.push({
            name: docData.name,
            options: docData.options,
            priority: docData.priority,
            select_type: docData.select_type,
            id: doc.id,
          });
          if (docData.select_type !== 0 && docData.options.length) {
            data[doc.id] = {
              name: docData.name,
              options: docData.options,
              priority: docData.priority,
            };
            filtersObj[doc.id] = [];
          }
        });
        return arr;
      });
    setCategories(cat);

    setFiltersState(filtersObj);
    setFiltersData(data);

    const collections2 = firestore.collection('providers');
    const provs = await collections2
      .where('team', '==', getTeam())
      .get()
      .then((querySnapshot) => {
        const arr = [];
        querySnapshot.forEach((doc) => {
          const docData = doc.data();
          arr.push(docData);
        });
        return arr;
      });
    setProviders(provs);
    setActiveProviders(provs);

    const teamCollection = firestore.collection('teams').doc(getTeam());
    const teamData = await teamCollection
      .get()
      .then((doc) => doc.data());
    setPrimaryColor(teamData.primaryColor);
    setSecondaryColor(teamData.secondaryColor);
    setDefaultLat(teamData.latitude);
    setDefaultLong(teamData.longitude);
    setDefaultZoom(teamData.zoom);
    setIsLoading(false);
  }

  const [width, setWidth] = useState(getWidth());

  useEffect(() => {
    const resizeListener = () => {
      if (width > 768 && getWidth() <= 768) {
        setSticky(false);
      }
      setWidth(getWidth());
    };
    window.addEventListener('resize', resizeListener);
    return () => {
      window.removeEventListener('resize', resizeListener);
    };
  }, []);

  const [isSticky, setSticky] = useState(false);
  const ref = useRef(null);
  const cellScrollRef = useRef(null);
  const listScrollRef = useRef(null);
  const handleScroll = (flip) => {
    if (flip || width <= 768) {
      if (ref.current && ref.current.getBoundingClientRect().top <= 70) {
        setSticky(true);
      } else if (isSticky) {
        setSticky(false);
      }
    }
  };

  const resetSticky = () => {
    setSticky(false);
    setTimeout(() => {
      listScrollRef.current.scrollTop = -1;
      cellScrollRef.current.scrollTop = 0;
    }, 100);
  };

  const filterByTags = (temp) => {
    setTempProviders(temp);
    Object.keys(filtersState).forEach((filterName) => {
      temp = temp.filter((provider) => (provider[filterName]
        ? provider[filterName].some((r) => filtersState[filterName].includes(r)) || filtersState[filterName].length === 0
        : true));
    });
    setActiveProviders(temp);
  };

  const filterZipcode = async (filterVal) => {
    const response = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${filterVal}&key=${GOOGLE_API_KEY}`);
    const responseJson = await response.json();

    // Handle illegal response
    const filterLat = responseJson.results[0].geometry.location.lat;
    const filterLong = responseJson.results[0].geometry.location.lng;
    let providerLat; let
      providerLong;
    const filteredProviders = [];

    const R = 6371e3;
    const pi = Math.PI;
    const metersPerMile = 1609.344;
    const theta1 = filterLat * (pi / 180);

    providers.forEach((provider) => {
      providerLat = provider.latitude;
      providerLong = provider.longitude;
      const distance = Math.pow(Math.abs(filterLat - providerLat), 2) + Math.pow(Math.abs(filterLong - providerLong), 2);

      const theta2 = providerLat * (pi / 180);
      const deltaTheta = (providerLat - filterLat) * (pi / 180);
      const deltaLambda = (providerLong - filterLong) * (pi / 180);
      const a = Math.sin(deltaTheta / 2) * Math.sin(deltaTheta / 2)
                + Math.cos(theta1) * Math.cos(theta2)
                * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const miDistance = (R * c) / metersPerMile;

      filteredProviders.push({ provider, latLongdistance: distance, miDistance: Math.round(miDistance) + 1 });
    });

    filteredProviders.sort((a, b) => (a.latLongdistance > b.latLongdistance ? 1 : -1));

    const filterActiveProviders = [];
    const filterDistances = [];
    filteredProviders.forEach((provider) => {
      filterActiveProviders.push(provider.provider);
      const distKey = provider.provider.facilityName;
      filterDistances.push({ [distKey]: provider.miDistance });
    });
    setDistances(filterDistances);
    setZipProviders(filterActiveProviders);
    setTimeout(() => filterSearch(searchName, filterVal, filterActiveProviders), 100);
  };

  const filterNormalFilters = (e) => {
    const filterName = e.target.name;
    const filterVal = e.target.value;
    if (e.target.type === 'checkbox' && e.target.checked) {
      setFiltersState({
        ...filtersState,
        [filterName]: [...filtersState[filterName], filterVal],
      });
    } else if (e.target.type === 'checkbox' && !e.target.checked) {
      setFiltersState({
        ...filtersState,
        [filterName]: filtersState[filterName].filter((
          filter,
        ) => filter !== filterVal),
      });
    }
  };

  const filterSearch = (filterVal, zipCode, zipProvs) => {
    const regex = new RegExp(`${filterVal.toLowerCase()}`, 'gi');
    let temp = providers;
    if (zipCode) {
      temp = zipProvs;
    }
    temp = temp.filter((item) => regex.test(item.facilityName));
    filterByTags(temp);
  };

  const filterProviders = async (e) => {
    if (typeof e !== 'undefined') {
      const filtertype = e.target.getAttribute('filtertype');
      const filterVal = e.target.value;
      if (filtertype === 'search') {
        setSearchName(filterVal);
        filterSearch(filterVal);
      } else if (filtertype === 'zipcode') {
        setSearchZip(filterVal.replace(/\D/g, ''));
        if (filterVal.length === 5) {
          await filterZipcode(filterVal);
        } else if (distances !== {}) {
          setDistances({});
        }
      } else {
        await filterNormalFilters(e);
      }
    }
  };

  useEffect(() => {
    if (activeProviders) filterSearch(searchName);
  }, [filtersState]);

  function switchView() {
    setListView(!listView);
  }

  function evaluateFilters() {
    let isFiltersEmpty = true;
    Object.keys(filtersState).map((item) => {
      if (filtersState[item].length > 0) {
        isFiltersEmpty = false;
      }
    });
    return !isFiltersEmpty;
  }

  function clearFilters() {
    setFiltersState(Object.keys(filtersState).reduce((acc, cur) => ({
      ...acc,
      [cur]: [],
    }), {}));
  }

  function renderTag(item, index) {
    return filtersState[item].map((title, key) => (
      <div
        className="tag"
        style={{ borderColor: '#007bff', color: '#007bff' }}
        key={`${index}${key}`}
      >
        { title }
        {' '}
        <span
          className="remove-tag"
          onClick={
            async () => {
              setFiltersState({
                ...filtersState,
                [item]: filtersState[item].filter(
                  (i) => i !== title,
                ),
              });
              setTimeout(() => filterProviders(), 100);
            }}>
          {' '}
          <FaTimesCircle />
        </span>
      </div>
    ));
  }

  function handleCellClick(index) {
    setSelectedIndex(index);
    setShowModal(true);
  }

  const renderTagControl = () => (
    <>
      {!condition && !isSticky && (
      <div ref={ref} className="scroll-indicator" />
      )}
      <div className={classNames('filter-row', 'padder')}>
        {Object.entries(filtersData)
          .filter(([key, value]) => Number.isInteger(value.priority)
                            && value.priority < FILTER_CUTOFF)
          .sort(
            ([aKey, aValue], [bKey, bValue]) => aValue.priority - bValue.priority,
          )
          .map(([key, value]) => renderDropdown(value.name, key))}

        {moreFilter ? (
          <>
            {Object.entries(filtersData)
              .filter(
                ([key, value]) => !Number.isInteger(value.priority)
                                        || value.priority >= FILTER_CUTOFF,
              )
              .sort(([aKey, aValue], [bKey, bValue]) => aValue.name.localeCompare(bValue.name))
              .map(([key, value]) => renderDropdown(value.name, key))}
            <Button
              variant="link"
              style={{ color: 'red' }}
              onClick={() => setMoreFilter(false)}
            >
              -
              {' '}
              {lessFilters}
            </Button>
          </>
        ) : (
          <Button
            variant="link"
            onClick={() => setMoreFilter(true)}
          >
            +
            {' '}
            {moreFilters}
          </Button>
        )}
      </div>
    </>
  );

  function renderDropdown(title, key) {
    return (
      <Dropdown key={key}>
        <Dropdown.Toggle
          variant="light"
          style={{ marginRight: 5, marginBottom: 5 }}
        >
          { title }
        </Dropdown.Toggle>
        <Dropdown.Menu>
          {
                        filtersData[key].options.map((item, index) => (
                          <div
                            key={index}
                            onClick={
                                        () => filterProviders({
                                          target: {
                                            name: key,
                                            value: item.value,
                                            type: 'checkbox',
                                            checked: !filtersState[key].includes(item.value),
                                            getAttribute: (param) => 'normalfilter',
                                          },
                                        })
                                    }
                          >
                            <Form.Check
                              className="dropdown-item"
                              name={key}
                              type="checkbox"
                              checked={filtersState[key].includes(item.value)}
                              value={item.value}
                              label={item.label}
                              filtertype="normalfilter"
                            />
                          </div>
                        ))
                    }
        </Dropdown.Menu>
      </Dropdown>
    );
  }

  // Localization is unused because it's hardcoded and doesn't fit with our dynamic model
  let {
    searchProviderName,
    searchZipcode,
    hideLabel,
    showLabel,
    lessFilters,
    moreFilters,
  } = localizationStrings;

  const condition = width > 768;

  if (isLoading || !isLoaded(activeProviders)) {
    return (
      <div className="spinner-wrap">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className={classNames('bg-white', { 'overflow-scroll': !condition })}>
      {/* <NavBar /> */}
      <div>
        <div>
          <div
            className={classNames('row-spaced', 'ml-2', 'mb-3', 'pt-3', { 'mr-2': !condition })}
          >
            <div className="w-75">
              <Row noGutters={!condition}>
                <Col>
                  <Form.Control
                    placeholder={searchZipcode}
                    filtertype="zipcode"
                    value={searchZip}
                    onChange={filterProviders}
                  />
                </Col>
                <Col>
                  <Form.Control
                    placeholder={searchProviderName}
                    filtertype="search"
                    onChange={filterProviders}
                  />
                </Col>
              </Row>
            </div>
            {
                            condition
                              ? (
                                <Button
                                  variant="primary"
                                  style={{ borderColor: primaryColor, backgroundColor: primaryColor }}
                                  onClick={switchView}
                                  className="switch-view-button"
                                >
                                  { listView ? hideLabel : showLabel }
                                </Button>
                              )
                              : isSticky
                                && (
                                <Button
                                  variant="outline-primary"
                                  style={{ borderColor: primaryColor, color: primaryColor }}
                                  onClick={resetSticky}
                                >
                                  <FaMap />
                                </Button>
                                )
                        }
          </div>
          {isSticky && renderTagControl()}
        </div>
        <div className={classNames({ 'row-nowrap': condition })}>
          <div
            ref={listScrollRef}
            onScroll={handleScroll}
            style={{ pointerEvents: point || condition || isSticky ? 'all' : 'none' }}
            className={classNames('map-list', { expand: !listView, sticky: isSticky && !condition })}
          >
            {
                            !isSticky && !condition
                            && (
                            <div
                              className="map-overlay"
                              onMouseEnter={() => setPoint(false)}
                            />
                            )
                        }
            <div
              className="map-container"
            >
              {!isSticky && renderTagControl()}
              <div ref={cellScrollRef} className={classNames('cell-container', { sticky: isSticky && !condition })}>
                <div className="tag-row padder">
                  {Object.keys(filtersState).map(renderTag)}
                  {
                                        evaluateFilters()
                                        && (
                                        <div
                                          onClick={() => clearFilters()}
                                          className="tag clear-all"
                                          style={{ borderColor: 'red', color: 'red' }}
                                        >
                                          Clear All
                                        </div>
                                        )
                                    }
                </div>
                <div className="count">
                  <span>
                    {
                                        isEmpty(activeProviders)
                                          ? 'No' : activeProviders.length
                                    }
                    {' '}
                    providers found
                  </span>
                </div>
                {
                                    !isEmpty(activeProviders)
                                    && activeProviders.map((i, index) => (
                                      <ProviderCell
                                        key={i.id}
                                        item={i}
                                        index={index}
                                        primaryColor={primaryColor}
                                        onMouseEnter={debounce(() => {
                                          if (listView && width > 768) setCurrmarker(index);
                                        }, 300)}
                                        onClick={() => handleCellClick(index)}
                                        distances={distances}
                                      />
                                    ))
                                }
              </div>
              <div>
                {
                                    width >= 768 && activeProviders && activeProviders[selectedIndex]
                                    && (
                                    <Modal
                                      show={showModal}
                                      onHide={() => setShowModal(false)}
                                      dialogClassName="myModal"
                                      scrollable
                                    >
                                      <Modal.Header
                                        style={{ backgroundColor: primaryColor }}
                                        closeButton
                                      />
                                      <Modal.Body
                                        className="modal-body"
                                      >
                                        <ProviderInfo item={activeProviders[selectedIndex]} categories={categories} />
                                      </Modal.Body>
                                    </Modal>
                                    )
                                }
                {
                                    width < 768 && activeProviders && activeProviders[selectedIndex]
                                    && (
                                    <Modal
                                      show={showModal}
                                      onHide={() => setShowModal(false)}
                                      dialogClassName="modalMobile"
                                      scrollable
                                    >
                                      <Modal.Header
                                        style={{ backgroundColor: primaryColor }}
                                        closeButton
                                      />
                                      <Modal.Body
                                        className="modal-body"
                                      >
                                        <ProviderInfoMobile item={activeProviders[selectedIndex]} width={width} categories={categories} />
                                      </Modal.Body>
                                    </Modal>
                                    )
                                }
              </div>
            </div>
          </div>
          {
                        !(isSticky && !condition)
                        && (
                        <div
                          id="map"
                          className={classNames({ 'map-hide': condition && !listView })}
                        >
                          <div
                            onMouseLeave={() => setPoint(true)}
                            style={{ height: condition ? 'calc(100vh - 70px)' : '60vh', width: '100%' }}
                          >
                            <GoogleMap
                              providers={activeProviders}
                              defaultZoom={defaultZoom}
                              primaryColor={primaryColor}
                              defaultCenter={{
                                lat: defaultLat,
                                lng: defaultLong,
                              }}
                              selectedMarker={currmarker}
                              onShowMoreClick={handleCellClick}
                            />
                          </div>
                        </div>
                        )
                    }
        </div>
      </div>
    </div>
  );
};

export default compose(withFirestore, connect((state) => ({
  firebase: state.firebase,
})))(Index);