/* global Module */

/* Magic Mirror
 * Module: MMM-CasperValidator
 *
 * By Toan Le
 * MIT Licensed.
 */

Module.register("MMM-CasperValidator", {
	defaults: {
		updateInterval: 60000,
		retryDelay: 5000,
		validatorAddress: ''
	},

	requiresVersion: "2.1.0", // Required version of MagicMirror

	start: function() {
		var self = this;
		var dataRequest = null;
		this.stakedInfo = {selfStaked: 0, totalStaked: 0, active: false};
		this.rewardDataRequest = null;
		this.nodeStatus = {
			theirNode: { era_id: 0, height: 0, next_upgrade: false },
			ourNode: { era_id: 0, height: 0, next_upgrade: null }
		};

		//Flag for check if module is loaded
		this.loaded = false;
		this.loadingFailed = false;

		// Schedule update timer.
		this.requestUpdate();
		setInterval(function() {
			self.requestUpdate();
		}, this.config.updateInterval);
	},

	requestUpdate: function() {
		this.sendSocketNotification("MMM-CasperValidator-THEIR_NODE_STATUS", { nodeUrl: this.config.theirNode });
		this.sendSocketNotification("MMM-CasperValidator-OUR_NODE_STATUS", { nodeUrl: this.config.ourNode });
		this.sendSocketNotification("MMM-CasperValidator-REWARDS", { validatorAddress: this.config.validatorAddress });
		this.sendSocketNotification("MMM-CasperValidator-GET_AUCTION_INFO", { validatorAddress: this.config.validatorAddress, nodeUrl: this.config.theirNode });
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

	createTiles: function(field_name, trunc) {
		trunc = (typeof trunc !== 'undefined') ? trunc : true;

		let valueElement = document.createElement("td");
		valueElement.className = "value number large align-center";
		valueElement.innerHTML = this.getLatestSerieValue(field_name, trunc);

		return valueElement;
	},

	compareNodes: function() {
		let data = this.nodeStatus;
		let tileTable = document.createElement("table");
		tileTable.className = "tiles";
		tileTable.innerHTML = `
			<tr>
				<td>ERA</td>
				<td class="value ${this.compareCssClass(data.ourNode.era_id, data.theirNode.era_id)}">${data.ourNode.era_id}</td>
				<td class="value green">${data.theirNode.era_id}</td>
			</tr>
			<tr>
				<td>Height</td>
				<td class="value ${this.compareCssClass(data.ourNode.height, data.theirNode.height)}">${data.ourNode.height}</td>
				<td class="value green">${data.theirNode.height}</td>
			</tr>
			<tr>
				<td>Node Status</td>
				<td class="value ${this.compareCssClass(this.isActiveNode(), true)}" colspan="2">${this.isActiveNodeLabel()}</td>
			</tr>
			<tr>
				<td>Upgrade Status</td>
				<td class="value ${this.compareCssClass(this.needUpgradeNode(), false)}" colspan="2">${this.needUpgradeNodeLabel()}</td>
			</tr>
		`;
		
		return tileTable;
	},

	compareCssClass: function(a, b) {
		return (a == b) ? "green" : "red";
	},

	isActiveNodeLabel: function() {
		return this.isActiveNode() ? "☘️ ACTIVE VALIDATOR ☘️" : "☠️ NOT VALIDATOR ☠️";
	},

	needUpgradeNodeLabel: function() {
		return this.needUpgradeNode() ? "☠️ NEED UPGRADE ☠️" : "✯ LATEST VERSION ✯";
	},

	parseRewardResults: function(json) {
		let results = [];
		
		json.data.forEach(element => {
			results.push({era_id: element.eraId, amount: element.amount / 1000000000, time: new Date(element.timestamp)});
		});

		return results;
	},

	isActiveNode: function() {
		let lastReward = this.rewardDataRequest && this.rewardDataRequest.data[0];

		return this.nodeStatus.ourNode.era_id > 0 && 
			lastReward && lastReward.amount > 0 && (new Date - new Date(lastReward.timestamp)) <= 2.2*3600*1000 &&
			this.stakedInfo.active
	},
	needUpgradeNode: function() {
		let nextTheirNodeVersion = this.nodeStatus.theirNode.next_upgrade && this.nodeStatus.theirNode.next_upgrade.protocol_version;
		let nextOurNodeVersion = this.nodeStatus.ourNode.next_upgrade && this.nodeStatus.ourNode.next_upgrade.protocol_version;

		return nextTheirNodeVersion != nextOurNodeVersion;
	},
	getDom: function() {
		var self = this;

		// create element wrapper for show into the module
		var wrapper = document.createElement("div");
		let tileTable = document.createElement("table");
		tileTable.innerHTML = `
			<tr>
				<td class='bright align-center'>Total Self Staked</td>
				<td></td>
				<td class='bright align-center'>Total Staked</td>
			</tr>
			<tr class="tiles">
				<td class="value number large align-center">${this.formatedCurrency(this.stakedInfo.selfStaked, true, true)}</td>
				<td class="padding-td"></td>
				<td class="value number large align-center">${this.formatedCurrency(this.stakedInfo.totalStaked, true, true)}</td>
			</tr>
		`;
		wrapper.appendChild(tileTable);

		wrapper.appendChild(document.createElement("hr"));
		wrapper.appendChild(this.compareNodes());

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

	// socketNotificationReceived from helper
	socketNotificationReceived: function (notification, payload) {
		switch(notification) {
			case "MMM-CasperValidator-THEIR_NODE_STATUS":
				this.nodeStatus.theirNode = payload;
				this.updateDom();
				break;
			case "MMM-CasperValidator-OUR_NODE_STATUS":
				this.nodeStatus.ourNode = payload;
				this.updateDom();
				break;
			case "MMM-CasperValidator-REWARDS":
				this.rewardDataRequest = payload;
				this.updateDom();
				break;
			case "MMM-CasperValidator-STAKED_INFO":
				this.stakedInfo = payload;
				this.updateDom();
				break;
		}
	}
});
