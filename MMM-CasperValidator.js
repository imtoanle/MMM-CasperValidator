/* global Module */

/* Magic Mirror
 * Module: MMM-CasperValidator
 *
 * By Toan Le
 * MIT Licensed.
 */

Module.register("MMM-CasperValidator", {
	defaults: {
		api_url: '',
		prometheus_job: '',
		updateInterval: 60000,
		retryDelay: 5000
	},

	requiresVersion: "2.1.0", // Required version of MagicMirror

	start: function() {
		var self = this;
		var dataRequest = null;
		var rewardDataRequest = null;
		var dataNotification = null;

		//Flag for check if module is loaded
		this.loaded = false;

		// Schedule update timer.
		this.getData();
		setInterval(function() {
			self.updateDom();
		}, this.config.updateInterval);
	},

	getLatestSerieValue: function(name, trunc, localeFormat) {
		localeFormat = (typeof localeFormat !== 'undefined') ? localeFormat : true;
		let m = this.dataRequest.data.result.filter(metric => { return metric.metric.__name__ == name })[0];
		return m && this.formatedCurrency(m.value[1], trunc, localeFormat);
	},

	formatedCurrency: function(number, trunc, locale){
		let v = number;
		if (trunc) v = Math.trunc(v);
		if (locale) v = new Number(v).toLocaleString("en-US");
		return v;
	},
	/*
	 * getData
	 * function example return data and show it in the module wrapper
	 * get a URL request
	 *
	 */
	getData: function() {
		var self = this;

		var params = `query={__name__=~"casper_validator_self_staked_amount|casper_validator_total_staked_amount|casper_validator_is_active|casper_validator_should_be_upgraded",job="${this.config.prometheus_job}"}`;
		var urlApi = `${this.config.api_url}/api/v1/query?${params}`;

		var startTime = new Date();
		startTime.setHours(startTime.getHours() - 10);
		var endTime = new Date();
		var rewardParams = `query=sum by(era_id)(casper_validator_era_rewards{job="${this.config.prometheus_job}"})&start=${startTime.toISOString()}&end=${endTime.toISOString()}&step=7200`;
		var rewardUrlApi = `${this.config.api_url}/api/v1/query_range?${rewardParams}`;

		var retry = true;

		var rewardDataRequest = new XMLHttpRequest();
		rewardDataRequest.open("GET", rewardUrlApi, true);
		rewardDataRequest.onreadystatechange = function() {
			if (this.readyState === 4) {
				if (this.status === 200) {
					self.rewardDataRequest = JSON.parse(this.response);
				} else {
					Log.error(self.name, "Could not load data.");
				}
			}
		};
		rewardDataRequest.send();

		var dataRequest = new XMLHttpRequest();
		dataRequest.open("GET", urlApi, true);
		dataRequest.onreadystatechange = function() {
			console.log(this.readyState);
			if (this.readyState === 4) {
				console.log(this.status);
				if (this.status === 200) {
					self.processData(JSON.parse(this.response));
				} else if (this.status === 401) {
					self.updateDom(self.config.animationSpeed);
					Log.error(self.name, this.status);
					retry = false;
				} else {
					Log.error(self.name, "Could not load data.");
				}
				if (retry) {
					self.scheduleUpdate((self.loaded) ? -1 : self.config.retryDelay);
				}
			}
		};
		dataRequest.send();
	},

	// getRewardsData: function() {
	// 	var self = this;

		// var startTime = new Date();
		// startTime.setHours(startTime.getHours() - 12);
		// var endTime = new Date();

	// 	var params = `query=sum by(era_id)(casper_validator_era_rewards{job="${this.config.prometheus_job}"})&start=${startTime.toISOString()}&end=${endTime.toISOString()}&step=7200`;
	// 	var urlApi = `${this.config.api_url}/api/v1/query_range?${params}`;
	// 	var retry = true;

	// 	var dataRequest = new XMLHttpRequest();
	// 	dataRequest.open("GET", urlApi, true);
	// 	dataRequest.onreadystatechange = function() {
	// 		console.log(this.readyState);
	// 		if (this.readyState === 4) {
	// 			console.log(this.status);
	// 			if (this.status === 200) {
	// 				self.processData(JSON.parse(this.response));
	// 			} else if (this.status === 401) {
	// 				self.updateDom(self.config.animationSpeed);
	// 				Log.error(self.name, this.status);
	// 				retry = false;
	// 			} else {
	// 				Log.error(self.name, "Could not load data.");
	// 			}
	// 			if (retry) {
	// 				self.scheduleUpdate((self.loaded) ? -1 : self.config.retryDelay);
	// 			}
	// 		}
	// 	};
	// 	dataRequest.send();
	// },


	/* scheduleUpdate()
	 * Schedule next update.
	 *
	 * argument delay number - Milliseconds before next update.
	 *  If empty, this.config.updateInterval is used.
	 */
	scheduleUpdate: function(delay) {
		var nextLoad = this.config.updateInterval;
		if (typeof delay !== "undefined" && delay >= 0) {
			nextLoad = delay;
		}
		nextLoad = nextLoad ;
		var self = this;
		setTimeout(function() {
			self.getData();
		}, nextLoad);
	},

	createTiles: function(title, field_name, trunc) {
		trunc = (typeof trunc !== 'undefined') ? trunc : true;

		let tileElement = document.createElement("div");
		tileElement.className = "tiles";

		let labelElement = document.createElement("label");
		labelElement.className = "bright";
		labelElement.innerHTML = title;

		let valueElement = document.createElement("div");
		valueElement.className = "value number";
		valueElement.innerHTML = this.getLatestSerieValue(field_name, trunc);

		tileElement.appendChild(labelElement);
		tileElement.appendChild(valueElement);

		return tileElement;
	},

	activeStatusPanel: function() {
		let tileElement = document.createElement("div");
		tileElement.className = "tiles";

		let status = this.getLatestSerieValue("casper_validator_is_active", false, false);

		let valueElement = document.createElement("div");

		if (status == "1") {
			valueElement.className = "value green";
			valueElement.innerHTML = "☘️ ACTIVE VALIDATOR ☘️";
		} else {
			valueElement.className = "value red";
			valueElement.innerHTML = "☠️ NOT VALIDATOR ☠️";
		}

		tileElement.appendChild(valueElement);
		return tileElement;
	},
	upgradeStatusPanel: function() {
		let tileElement = document.createElement("div");
		tileElement.className = "tiles";

		let status = this.getLatestSerieValue("casper_validator_should_be_upgraded", false, false);

		let valueElement = document.createElement("div");

		if (status == "0") {
			valueElement.className = "value green";
			valueElement.innerHTML = "🌟 LATEST VERSION 🌟";
		} else {
			valueElement.className = "value red";
			valueElement.innerHTML = "☠️ UPGRADE ☠️";
		}

		tileElement.appendChild(valueElement);
		return tileElement;
	},

	recentRewardsPanel: function() {

	},

	parseRewardResults: function(json) {
		let results = [];
		
		json.data.result.forEach(element => {
			results.push({era_id: element.metric.era_id, amount: element.values[0][1]});
		});

		return results;
	},
	getDom: function() {
		var self = this;

		// create element wrapper for show into the module
		var wrapper = document.createElement("div");
		// If this.dataRequest is not empty
		if (this.dataRequest) {
			// var labelDataRequest = document.createElement("label");
			// // Use translate function
			// //             this id defined in translations files
			// labelDataRequest.innerHTML = this.translate("TITLE");


			wrapper.appendChild(this.createTiles("Total Self Staked", "casper_validator_self_staked_amount"));
			// wrapper.appendChild(document.createElement("hr"));
			wrapper.appendChild(this.createTiles("Total Staked", "casper_validator_total_staked_amount"));
			wrapper.appendChild(this.activeStatusPanel());
			wrapper.appendChild(this.upgradeStatusPanel());
		}

		if (this.rewardDataRequest) {
			let rewardsHeader = document.createElement("header");
			rewardsHeader.className = "module-header";
			rewardsHeader.innerHTML = "Recent Rewards";

			wrapper.appendChild(rewardsHeader);

			let rewardTable = document.createElement("table");
			rewardTable.className = "small";

			this.parseRewardResults(this.rewardDataRequest).forEach(element => {
				let trElement = document.createElement("tr");
				trElement.innerHTML = `<td class="symbol align-right "><span class="fa fa-fw fa-donate"></span></td><td class="title bright ">ERA - ${element.era_id}</td><td class="time light bright">${this.formatedCurrency(element.amount, false, true)}</td>`;
				rewardTable.appendChild(trElement);
			});

			wrapper.appendChild(rewardTable);
		}

		// Data from helper
		// if (this.dataNotification) {
		// 	var wrapperDataNotification = document.createElement("div");
		// 	// translations  + datanotification
		// 	wrapperDataNotification.innerHTML =  this.translate("UPDATE") + ": " + this.dataNotification.date;

		// 	wrapper.appendChild(wrapperDataNotification);
		// }
		return wrapper;
	},

	getScripts: function() {
		return [];
	},

	getStyles: function () {
		return [
			"MMM-CasperValidator.css",
		];
	},

	// Load translations files
	getTranslations: function() {
		//FIXME: This can be load a one file javascript definition
		return {
			en: "translations/en.json",
			es: "translations/es.json"
		};
	},

	processData: function(data) {
		var self = this;
		this.dataRequest = data;
		if (this.loaded === false) { self.updateDom(self.config.animationSpeed) ; }
		this.loaded = true;

		// the data if load
		// send notification to helper
		this.sendSocketNotification("MMM-CasperValidator-NOTIFICATION_TEST", data);
	},

	// socketNotificationReceived from helper
	socketNotificationReceived: function (notification, payload) {
		if(notification === "MMM-CasperValidator-NOTIFICATION_TEST") {
			// set dataNotification
			this.dataNotification = payload;
			this.updateDom();
		}
	},
});
