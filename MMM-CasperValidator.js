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
		retryDelay: 5000,
		validatorAddress: ''
	},

	requiresVersion: "2.1.0", // Required version of MagicMirror

	start: function() {
		var self = this;
		var dataRequest = null;
		var rewardDataRequest = null;
		var nodeStatus = null;

		//Flag for check if module is loaded
		this.loaded = false;
		this.loadingFailed = false;

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

		this.getRewardsData(self);
		// this.getCasperOfficialRPC();

		var dataRequest = new XMLHttpRequest();
		dataRequest.open("GET", urlApi, true);
		dataRequest.onreadystatechange = function() {
			if (this.readyState === 4) {
				if (this.status === 200) {
					self.loadingFailed = false;
					self.processData(JSON.parse(this.response));
				} else if (this.status === 401) {
					self.updateDom(self.config.animationSpeed);
					Log.error(self.name, this.status);
					retry = false;
				} else {
					self.loadingFailed = true;
					self.updateDom(self.config.animationSpeed);
					Log.error(self.name, "Could not load data.");
				}
				if (retry) {
					self.scheduleUpdate((self.loaded) ? -1 : self.config.retryDelay);
				}
			}
		};
		dataRequest.send();
	},

	getCasperOfficialRPC: function() {
		var self = this;
		let request = new XMLHttpRequest();
		let params = JSON.stringify({
			id: "0",
			jsonrpc: "2.0",
			method: "info_get_status"
		});

		request.open("POST", 'https://node-clarity-mainnet.make.services/rpc', true);
		request.setRequestHeader("Content-Type", "application/json");
		request.setRequestHeader("User-Agent", "PostmanRuntime/7.28.4");
		request.setRequestHeader("Accept", "*/*");
		request.setRequestHeader("Accept-Encoding", "gzip, deflate, br");
		request.setRequestHeader("Connection", "keep-alive");
		
		request.onreadystatechange = function() {
			if (this.readyState === 4) {
				if (this.status === 200) {
					// self.loadingFailed = false;
					// self.rewardDataRequest = JSON.parse(this.response);
					// self.updateDom(self.config.animationSpeed);
					console.log(this.response);
				} else {
					self.loadingFailed = true;
					self.updateDom(self.config.animationSpeed);
					Log.error(self.name, "Could not load data.");
				}
			}
		};
		request.send(params);
	},

	getRewardsData: function() {
		var self = this;
		let request = new XMLHttpRequest();
		let rewardUrlApi = `https://event-store-api-clarity-mainnet.make.services/validators/${this.config.validatorAddress}/rewards?with_amounts_in_currency_id=1&page=1&limit=4&order_direction=DESC`;
		request.open("GET", rewardUrlApi, true);
		request.onreadystatechange = function() {
			if (this.readyState === 4) {
				if (this.status === 200) {
					self.loadingFailed = false;
					self.rewardDataRequest = JSON.parse(this.response);
					self.updateDom(self.config.animationSpeed);
				} else {
					self.loadingFailed = true;
					self.updateDom(self.config.animationSpeed);
					Log.error(self.name, "Could not load data.");
				}
			}
		};
		request.send();
	},

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

	createTiles: function(field_name, trunc) {
		trunc = (typeof trunc !== 'undefined') ? trunc : true;

		let valueElement = document.createElement("td");
		valueElement.className = "value number large align-center";
		valueElement.innerHTML = this.getLatestSerieValue(field_name, trunc);

		return valueElement;
	},

	compareNodes: function(data) {
		let tileTable = document.createElement("table");
		tileTable.className = "tiles";
		tileTable.innerHTML = `
			<tr>
				<td></td>
				<td class='bright'>Our Node</td>
				<td class='bright'>Their Node</td>
			</tr>
			<tr>
				<td>ERA</td>
				<td class="${this.compareCssClass(data.ourNode.era_id, data.theirNode.era_id)}">${data.ourNode.era_id}</td>
				<td class="green">${data.theirNode.era_id}</td>
			</tr>
			<tr>
				<td>Height</td>
				<td class="${this.compareCssClass(data.ourNode.height, data.theirNode.height)}">${data.ourNode.height}</td>
				<td class="green">${data.theirNode.height}</td>
			</tr>
		`;
		
		return tileTable;
	},

	compareCssClass: function(a, b) {
		return (a == b) ? "green" : "red";
	},

	activeStatusPanel: function() {
		let tileElement = document.createElement("div");
		tileElement.className = "tiles";

		let status = this.getLatestSerieValue("casper_validator_is_active", false, false);

		let valueElement = document.createElement("div");
		valueElement.className = "value light align-center";

		if (this.loadingFailed) {
			valueElement.className += " red";
			valueElement.innerHTML = "☠️ INTERNET FAILED ☠️";
		} else if (status == "1") {
			valueElement.className += " green";
			valueElement.innerHTML = "☘️ ACTIVE VALIDATOR ☘️";
		} else {
			valueElement.className += " red";
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
		valueElement.className = "value light align-center";

		if (status == "0") {
			valueElement.className += " green";
			valueElement.innerHTML = "✯ LATEST VERSION ✯";
		} else {
			valueElement.className += " red";
			valueElement.innerHTML = "☠️ UPGRADE ☠️";
		}

		tileElement.appendChild(valueElement);
		return tileElement;
	},

	recentRewardsPanel: function() {

	},

	parseRewardResults: function(json) {
		let results = [];
		
		json.data.forEach(element => {
			results.push({era_id: element.eraId, amount: element.amount / 1000000000, time: new Date(element.timestamp)});
		});

		return results;
	},
	getDom: function() {
		var self = this;

		// create element wrapper for show into the module
		var wrapper = document.createElement("div");
		// If this.dataRequest is not empty
		if (this.dataRequest) {
			let tileTable = document.createElement("table");
			let tileHeaderRow = document.createElement("tr");
			tileHeaderRow.innerHTML = "<td class='bright align-center'>Total Self Staked</td><td></td><td class='bright align-center'>Total Staked</td>";
			tileTable.appendChild(tileHeaderRow);

			let tileDataRow = document.createElement("tr");
			tileDataRow.className = "tiles";
			tileDataRow.appendChild(this.createTiles("casper_validator_self_staked_amount"));
			let paddingTd = document.createElement("td");
			paddingTd.className = "padding-td";
			tileDataRow.appendChild(paddingTd);
			tileDataRow.appendChild(this.createTiles("casper_validator_total_staked_amount"));
			tileTable.appendChild(tileDataRow);
			wrapper.appendChild(tileTable);

			if (this.nodeStatus) {
				wrapper.appendChild(document.createElement("hr"));
				wrapper.appendChild(this.compareNodes(this.nodeStatus));
			}

			wrapper.appendChild(document.createElement("hr"));
			wrapper.appendChild(this.activeStatusPanel());
			wrapper.appendChild(this.upgradeStatusPanel());
		}

		if (this.rewardDataRequest) {
			wrapper.appendChild(document.createElement("hr"));

			let rewardTable = document.createElement("table");
			rewardTable.className = "small";

			this.parseRewardResults(this.rewardDataRequest).forEach(element => {
				let trElement = document.createElement("tr");
				trElement.innerHTML = `<td class="symbol align-right font-medium bright"><span class="fa fa-fw fa-donate"></span> ${element.era_id}</td><td class="title bright font-medium">${element.time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}</td><td class="time bright font-medium">${this.formatedCurrency(element.amount, false, true)}</td>`;
				rewardTable.appendChild(trElement);
			});

			wrapper.appendChild(rewardTable);
		}

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
		this.sendSocketNotification("MMM-CasperValidator-COMPARE_NODES", { theirNode: this.config.theirNode, ourNode: this.config.ourNode });
	},

	// socketNotificationReceived from helper
	socketNotificationReceived: function (notification, payload) {
		if(notification === "MMM-CasperValidator-COMPARE_NODES") {
			this.nodeStatus = payload;
			this.updateDom();
		}
	},
});
