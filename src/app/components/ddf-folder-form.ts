import {Component, OnInit, Output, NgZone, Injectable, EventEmitter} from '@angular/core';
import {PresetService, Preset} from './preset-service';
import {IAdditionalDataItem} from './additional-data';

const ddfCsvReaderLib = require('vizabi-ddfcsv-reader');
const BackendFileReader = ddfCsvReaderLib.BackendFileReader;

const template = require('./ddf-folder-form.html');

declare var electron: any;

class Option {
  value: string;
  title: string;
}

@Injectable()
@Component({
  selector: 'ae-ddf-folder-form',
  template: template
})
export class DdfFolderFormComponent implements OnInit {
  public fileReader: any;
  public ddfChartTypes: Option[] = [
    {value: 'BubbleChart', title: 'Bubble Chart'},
    {value: 'MountainChart', title: 'Mountain Chart'},
    {value: 'BubbleMap', title: 'Bubble Map'}
  ];
  public electronPath: string;
  public ddfChartType: string = this.ddfChartTypes[0].value;
  public expertMode = false;
  public ddfError: string;
  public ddfUrl: string = '';
  public ddfTranslationsUrl: string = '';
  public mainQuery: any = {};
  public measures: any[] = [];
  public dimensions: any[] = [];
  public isDiagnostic: boolean = false;
  public xAxis: string = 'income_per_person_gdppercapita_ppp_inflation_adjusted';
  public yAxis: string = 'life_expectancy_years';
  public sizeAxis: string = 'population_total';
  public startTime: string = '1990';
  public currentTime: string = '2015';
  public endTime: string = '2015';
  public electronUrl: string = '';
  public translations: string = '';
  public loadedDataHash: any = {};
  public currentPreset: Preset;
  public additionalData: Array<IAdditionalDataItem> = [];

  @Output() done: EventEmitter<any> = new EventEmitter();

  constructor(private _ngZone: NgZone,
              private presets: PresetService) {
    this.fileReader = new BackendFileReader();
    this.currentPreset = this.presets.getItems()[0];

    electron.ipcRenderer.send('get-app-path');
  }

  ngOnInit() {
    electron.ipcRenderer.on('got-app-path', (event, path) => {
      this.electronPath = path;

      this.defaults();
    });
  }

  onSelect(expectedVariableName, ddfChartType) {
    this._ngZone.run(() => {
      this[expectedVariableName] = ddfChartType;
    });
  }

  onPresetSelect(presetName) {
    this._ngZone.run(() => {
      const currentPreset =
        this.presets.getItems()
          .filter(presetItem => presetItem.name === presetName)[0];

      if (currentPreset) {
        this.currentPreset = currentPreset;
      }
    });
  }

  public defaults() {
    this.ddfUrl = this.electronPath + '/ddf--gapminder--systema_globalis';
    this.ddfTranslationsUrl = 'preview-data/translation/en.json';

    this.loadMeasures(null);
  }

  public getDdfCsvReaderObject() {
    return ddfCsvReaderLib;
  }

  public loadMeasures(onMeasuresLoaded) {
    if (!onMeasuresLoaded) {
      onMeasuresLoaded = () => {
      };
    }


    this.ddfError = '';

    const translationsLoader = this.prepareTranslations();

    translationsLoader((error, translations) => {
      this._ngZone.run(() => {
        if (error) {
          this.ddfError = error;
          onMeasuresLoaded(this.ddfError);
          return;
        }

        this.translations = translations;

        onMeasuresLoaded();
      });
    });
  }

  public isGoodToBeProcessed() {
    return true;
  }

  public getQuery(): any {
    this.ddfError = '';

    const queryObj = this.currentPreset.model.BubbleChart;
    queryObj.data.ddfPath = this.ddfUrl;
    queryObj.data.path = this.ddfUrl;

    return queryObj;
  }

  prepareTranslations() {
    return onTranslationsLoaded => {
      const loader = this.xhrLoad;

      loader(this.ddfTranslationsUrl, translations => {
        let ddfError = '';
        let translationsContent = null;

        try {
          translationsContent = JSON.parse(translations);
        } catch (e) {
          ddfError += '\nWrong JSON format for translations: ' + e;
        }

        onTranslationsLoaded(ddfError, translationsContent);
      });
    };
  }

  xhrLoad(path, onDataLoaded) {
    const xhr = new XMLHttpRequest();

    xhr.open('GET', path, true);
    xhr.onload = () => {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          onDataLoaded(xhr.responseText);
        }
      }
    };
    xhr.send(null);
  }

  areMeasuresBadForGo() {
    const areMeasuresBadForGoForBubbleMap = () => this.ddfChartType === 'BubbleMap' && !this.sizeAxis;
    const areMeasuresBadForGoForBubbleAndMountainCharts = () =>
      ((this.ddfChartType === 'BubbleChart' || this.ddfChartType === 'MountainChart') &&
      (!this.xAxis || !this.yAxis || !this.sizeAxis));

    return areMeasuresBadForGoForBubbleMap() || areMeasuresBadForGoForBubbleAndMountainCharts();
  }

  cantGo() {
    return this.ddfError || this.areMeasuresBadForGo();
  }

  openDdf() {
    this.done.emit({ddfFolderForm: this});
  }

  close() {
    this.done.emit({});
  }

  onFileChanged(event: any) {
    if (event.srcElement.files && event.srcElement.files.length > 0) {
      this.ddfUrl = event.srcElement.files[0].path;
    }
  }

  additionalDataChanged(data: Array<IAdditionalDataItem>) {
    this.additionalData = data;
  }
}
