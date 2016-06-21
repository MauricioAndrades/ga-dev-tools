// Copyright 2016 Google Inc. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.


import React from 'react';
import { Tab, Tabs, TabList, TabPanel } from 'react-tabs';
import accountSummaries from 'javascript-api-utils/lib/account-summaries';

import {composeRequest} from '../request';
import Datepicker from './datepicker';
import HelpIconLink from './help-icon-link';
import RequestViewer from './request-viewer';
import QueryReport from './query-report';
import Select2MultiSuggest from './select2-multi-suggest';
import ViewSelector from './view-selector';
import BarChartComponent from './bar-chart';

import {ga} from '../../analytics';
import AlertDispatcher from '../../components/alert-dispatcher';
import SearchSuggest from '../../components/search-suggest';


/**
 * The parameters that are safe to track the values entered by users.
 * All other params are either uninteresting or may possibly contain PII and
 * therefore only their presence/absense is tracked.
 */
const PARAMS_TO_TRACK = ['startDate', 'endDate', 'metrics', 'dimensions'];
const REQUEST_TYPES = ['HISTOGRAM', 'PIVOT', 'COHORT'];


export default class RequestComposer extends React.Component {

  /**
   * Invoked when a user changes the ViewSelector2 instance.
   * @param {Object} viewData The object emited by the ViewSelector2's
   * `changeView` event.
   */
  handleViewSelectorChange = (viewData) => {
    let {actions} = this.props;
    let {viewId} = viewData;
    actions.updateParams({viewId});
    actions.updateMetricsDimensionsAndSortOptions(viewData);
  }


  /**
   * Invoked when a user changes any of the <QueryForm> fields.
   * @param {Event|Object} e A native Event object, React event, or data object
   *     containing the target.name and target.value properties.
   */
  handleParamChange = ({target: {name, value}}) => {
    this.props.actions.updateParams({[name]: value});

    if (name == 'metrics' || name == 'dimensions') {
      this.props.actions.updateSortOptions();
    }
  }

    /**
   * Invoked when a user changes the request type.
   * @param Int index The index of the selcected request tab.
   * @param Int last The index of the last selected request tab.
   */
  handleRequestChange = (index, last) => {
    this.props.actions.updateSettings({requestType: REQUEST_TYPES[index]})
  }

  /**
   * Invoked when a user clicks on the segment definition checkbox.
   * @param {{target: Element}} The React event.
   */
  handleSegmentDefinitionToggle = ({target: {checked: useDefinition}}) => {
    let {actions} = this.props;
    let {segment} = this.props.params;

    actions.updateSettings({useDefinition});
    actions.updateSegmentsOptions(useDefinition);

    if (segment) {
      actions.swapSegmentIdAndDefinition(segment, useDefinition);
    }
  }



  /**
   * Invoked when a user submits the <QueryForm>.
   * @param {Event|Object} e The native or React event.
   */
  handleSubmit = async (e) => {
    e.preventDefault();
    let {actions, params, settings} = this.props;
    let paramsClone = {...params};

    actions.updateReport({params: paramsClone});
    actions.setQueryState(true);

    let trackableParamData = Object.keys(paramsClone).map((key) =>
        PARAMS_TO_TRACK.includes(key) ? `${key}=${paramsClone[key]}` : key)
        .join('&');

    // Set it on the tracker so it gets sent with all Query Explorer hits.
    ga('set', 'dimension2', trackableParamData);

    let summaries = await accountSummaries.get();
    let viewId = params.viewId;
    let view = summaries.getView(viewId);
    let property = summaries.getPropertyByViewId(viewId);


    let request = composeRequest(params, settings);
    gapi.client.analyticsreporting.reports.batchGet(request
      ).then(function(response) {
        console.log('REQUEST COMPOSER QUERY SUCCEEDED!!!');
        actions.updateResponse(response);
      }, function(response) {
        //"{ "error": { "code": 400, "message": "Invalid value at 'report_requests[0].dimensions[0].histogram_buckets[1]' (TYPE_INT64), \" 343\"\nInvalid value at 'report_requests[0].dimensions[0].histogram_buckets[2]' (TYPE_INT64), \" 100\"", "status": "INVALID_ARGUMENT", "details": [ { "@type": "type.googleapis.com/google.rpc.BadRequest", "fieldViolations": [ { "field": "report_requests[0].dimensions[0].histogram_buckets[1]", "description": "Invalid value at 'report_requests[0].dimensions[0].histogram_buckets[1]' (TYPE_INT64), \" 343\"" }, { "field": "report_requests[0].dimensions[0].histogram_buckets[2]", "description": "Invalid value at 'report_requests[0].dimensions[0].histogram_buckets[2]' (TYPE_INT64), \" 100\"" } ] } ] } } "
        console.log('REQUST COMPOSER QUERY FAILED!!!!!');
        actions.updateResponse(response)
    });

    actions.setQueryState(false);

    actions.updateReport({
      propertyName: property.name,
      viewName: view.name
    });
  }


  /**
   * React lifecycyle method below:
   * http://facebook.github.io/react/docs/component-specs.html
   * ---------------------------------------------------------
   */
  render() {

    let {
      isQuerying,
      params,
      report,
      response,
      settings,
      select2Options
    } = this.props;

    let formControlClass = 'FormControl FormControl--inline';
    let formActionClass = formControlClass + ' FormControl--action';
    let requiredFormControlClass = formControlClass +' FormControl--required';
    let maximumSelectionSize = 2;

    return (
      <div>
        <h3 className="H3--underline">Select a view</h3>

        <ViewSelector
          viewId={params.viewId}
          onChange={this.handleViewSelectorChange} />

      <Tabs
        onSelect={this.handleRequestChange}
        selectedIndex={REQUEST_TYPES.indexOf(settings.requestType)}
      >
        <TabList>
          <Tab>Histogram Request</Tab>
          <Tab>Pivot Request</Tab>
          <Tab>Cohort Request</Tab>
        </TabList>
        <TabPanel>
          <h2>For dimensions with integer values, 
            it is easier to understand their characteristics 
            by bucketing their values into ranges. 
          </h2>
        </TabPanel>
        <TabPanel>
          <h2>Google Analytics Reporting API V4 allows you
            to generate Pivot Tables. To construct a request
            with a pivot table, define the Pivot field in the 
            ReportRequest.
          </h2>
        </TabPanel>
        <TabPanel>
          <h2>A cohort is a group of users who share a common
            characteristic. For example, all users with the same
            Acquisition Date belong to the same cohort. The Cohort
            Analysis report lets you isolate and analyze cohort behavior.
          </h2>
        </TabPanel>
      </Tabs>

        <h3 className="H3--underline">Set the query parameters</h3>

        <form onSubmit={this.handleSubmit}>

          <div className={requiredFormControlClass}>
            <label className="FormControl-label">viewId</label>
            <div className="FormControl-body">
              <div className="FlexLine">
                <input
                  className="FormField FormFieldCombo-field"
                  name="viewId"
                  value={params.viewId}
                  onChange={this.handleParamChange} />
                <HelpIconLink name="ReportRequest.FIELDS.view_id" />
              </div>
            </div>
          </div>

          <div className={requiredFormControlClass}>
            <label className="FormControl-label">startDate</label>
            <div className="FormControl-body">
              <div className="FlexLine">
                <Datepicker
                  name="startDate"
                  value={params['startDate']}
                  onChange={this.handleParamChange} />
                <HelpIconLink name="DateRange.FIELDS.start_date" />
              </div>
            </div>
          </div>

          <div className={requiredFormControlClass}>
            <label className="FormControl-label">endDate</label>
            <div className="FormControl-body">
              <div className="FlexLine">
                <Datepicker
                  name="endDate"
                  value={params['endDate']}
                  onChange={this.handleParamChange} />
                <HelpIconLink name="DateRange.FIELDS.start_date" />
              </div>
            </div>
          </div>

          <div className={requiredFormControlClass}>
            <label className="FormControl-label">metrics</label>
            <div className="FormControl-body">
              <div className="FlexLine">
                <Select2MultiSuggest
                  name="metrics"
                  value={params.metrics}
                  tags={select2Options.metrics}
                  onChange={this.handleParamChange}
                  maximumSelectionSize={maximumSelectionSize} />
                <HelpIconLink name="ReportRequest.FIELDS.metrics" />
              </div>
            </div>
          </div>

          <div className={formControlClass}>
            <label className="FormControl-label">dimensions</label>
            <div className="FormControl-body">
              <div className="FlexLine">
                <Select2MultiSuggest
                  name="dimensions"
                  value={params.dimensions}
                  tags={select2Options.dimensions}
                  onChange={this.handleParamChange}
                  maximumSelectionSize={maximumSelectionSize} />
                <HelpIconLink name="ReportRequest.FIELDS.dimensions" />
              </div>
            </div>
          </div>

          {settings.requestType == 'PIVOT' ? (
          <div className={formControlClass}>
            <label className="FormControl-label">Pivot Metrics</label>
            <div className="FormControl-body">
              <div className="FlexLine">
                <Select2MultiSuggest
                  name="metrics"
                  value={params.pivotmetrics}
                  tags={select2Options.metrics}
                  onChange={this.handleParamChange}
                  maximumSelectionSize={maximumSelectionSize} />
                <HelpIconLink name="Pivot.FIELDS.metrics" />
              </div>
            </div>
          </div>
          ) :
          null}

          {settings.requestType == 'PIVOT' ? (
          <div className={formControlClass}>
            <label className="FormControl-label">Pivot Dimensions</label>
            <div className="FormControl-body">
              <div className="FlexLine">
                <Select2MultiSuggest
                  name="dimensions"
                  value={params.pivotdimensions}
                  tags={select2Options.dimensions}
                  onChange={this.handleParamChange}
                  disabled={settings.requestType == 'PIVOT'}/>
                <HelpIconLink name="Pivot.FIELDS.dimensions" />
              </div>
            </div>
          </div>
          ) :
          null}

          {settings.requestType == 'PIVOT' ? (
          <div className={formControlClass}>
            <label className="FormControl-label">Pivot startGroup</label>
            <div className="FormControl-body">
              <div className="FlexLine">
                <input
                  className="FormField FormFieldCombo-field"
                  name="start-index"
                  value={params['startGroup'] || ''}
                  onChange={this.handleParamChange}
                  disabled={settings.requestType == 'PIVOT'} />
                <HelpIconLink name="Pivot.FIELDS.startGroupCount" />
              </div>
            </div>
          </div>
          ) :
          null}

          {settings.requestType == 'PIVOT' ? (
          <div className={formControlClass}>
            <label className="FormControl-label">Pivot maxGroupCount</label>
            <div className="FormControl-body">
              <div className="FlexLine">
                <input
                  className="FormField FormFieldCombo-field"
                  name="max-results"
                  value={params['maxGroupCount'] || ''}
                  onChange={this.handleParamChange} 
                  disabled={settings.requestType == 'PIVOT'}/>
                <HelpIconLink name="Pivot.FIELDS.maxGroupCount" />
              </div>
            </div>
          </div>
          ) :
          null}

          <div className={formControlClass}>
            <label className="FormControl-label">Order By</label>
            <div className="FormControl-body">
              <div className="FlexLine">
                <Select2MultiSuggest
                  name="sort"
                  value={params.sort}
                  tags={select2Options.sort}
                  onChange={this.handleParamChange}
                  maximumSelectionSize={maximumSelectionSize} />
                <HelpIconLink name="ReportRequest.FIELDS.order_bys" />
              </div>
            </div>
          </div>

          {settings.requestType == 'HISTOGRAM' ? (
          <div className={formControlClass}>
            <label className="FormControl-label">Buckets</label>
            <div className="FormControl-body">
              <div className="FlexLine">
                <input
                  className="FormField FormFieldCombo-field"
                  name="buckets"
                  value={params['buckets']}
                  onChange={this.handleParamChange} />
                <HelpIconLink name="Dimension.FIELDS.histogram_buckets" />
              </div>
            </div>
          </div>
          ) :
          null}

          <div className={formControlClass}>
            <label className="FormControl-label">filters</label>
            <div className="FormControl-body">
              <div className="FlexLine">
                <input
                  className="FormField FormFieldCombo-field"
                  name="filters"
                  value={params.filters}
                  onChange={this.handleParamChange} />
                <HelpIconLink name="ReportRequest.FIELDS.filters_expression" />
              </div>
            </div>
          </div>

          <div className={formControlClass}>
            <label className="FormControl-label">segment</label>
            <div className="FormControl-body">
              <div className="FlexLine">
                <SearchSuggest
                  name="segment"
                  value={params.segment}
                  options={select2Options.segments}
                  onChange={this.handleParamChange} />
                <HelpIconLink name="ReportRequest.FIELDS.segments" />
              </div>
              <div className="FormControl-info">
                <label>
                  <input
                    className="Checkbox"
                    type="checkbox"
                    onChange={this.handleSegmentDefinitionToggle}
                    checked={settings.useDefinition} />
                  Show segment definitions instead of viewId.
                </label>
              </div>
            </div>
          </div>

          <div className={formControlClass}>
            <label className="FormControl-label">samplingLevel</label>
            <div className="FormControl-body">
              <div className="FlexLine">
                <input
                  className="FormField FormFieldCombo-field"
                  name="samplingLevel"
                  value={params.samplingLevel}
                  onChange={this.handleParamChange} />
                <HelpIconLink name="ReportRequest.FIELDS.sampling_level" />
              </div>
            </div>
          </div>

          <div className={formControlClass}>
            <label className="FormControl-label">includeEmptyRows</label>
            <div className="FormControl-body">
              <div className="FlexLine">
                <input
                  className="FormField FormFieldCombo-field"
                  name="includeEmptyRows"
                  value={params['includeEmptyRows']}
                  onChange={this.handleParamChange} />
                <HelpIconLink name="ReportRequest.FIELDS.include_empty_rows" />
              </div>
            </div>
          </div>

          <div className={formControlClass}>
            <label className="FormControl-label">pageToken</label>
            <div className="FormControl-body">
              <div className="FlexLine">
                <input
                  className="FormField FormFieldCombo-field"
                  name="pageToken"
                  value={params['pageToken']}
                  onChange={this.handleParamChange} />
                <HelpIconLink name="ReportRequest.FIELDS.page_token" />
              </div>
            </div>
          </div>

          <div className={formControlClass}>
            <label className="FormControl-label">pageSize</label>
            <div className="FormControl-body">
              <div className="FlexLine">
                <input
                  className="FormField FormFieldCombo-field"
                  name="pageSize"
                  value={params['pageSize']}
                  onChange={this.handleParamChange} />
                <HelpIconLink name="ReportRequest.FIELDS.page_size" />
              </div>
            </div>
          </div>

          <div className={formActionClass}>
            <div className="FormControl-body">
              <button
                className="Button Button--action"
                disabled={isQuerying}>
                {isQuerying ? 'Loading...' : 'Run Query'}
              </button>
            </div>
          </div>

        </form>

        <RequestViewer 
          params={params}
          settings={settings}
        />

        <BarChartComponent
        response={response}
        />


      </div>
    );
  }
}