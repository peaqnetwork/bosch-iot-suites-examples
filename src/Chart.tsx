/**
 * Copyright (C)2019, Justin Nguyen
 */
import React, { useEffect, useState } from 'react';
import Highcharts from 'highcharts/highstock'
import HighchartsReact from 'highcharts-react-official';

export const Chart = (props: any) => {
  const [chartOptions, setChartOptions] = useState({
    chart: {
      height: 320,
    },
    title: {
      text: props.chartTitle
    },
    xAxis: {
      type: 'datetime'
    },
    time: {
      useUTC: false
    },
    rangeSelector: {
      enabled: false
    },
    navigator: {
      enabled: false
    },
    scrollbar: {
      enabled: false
    },
    series: [{
      showInLegend: false,
      data: props.data
    }]
  });

  useEffect(() => {
    setChartOptions({
      ...chartOptions,
      series: [{
        showInLegend: false,
        data: props.data
      }]
    })
  }, [props.data?.length])

  return (<div>
    <HighchartsReact
      key={props.chartTitle}
      immutable={true}
      highcharts={Highcharts}
      constructorType={'stockChart'}
      options={chartOptions}
    />
  </div>)
}
