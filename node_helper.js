/* Magic Mirror
 * Node Helper: MMM-CasperValidator
 *
 * By Toan Le
 * MIT Licensed.
 */

var NodeHelper = require("node_helper");
const axios = require('axios');

module.exports = NodeHelper.create({

	// Override socketNotificationReceived method.

	/* socketNotificationReceived(notification, payload)
	 * This method is called when a socket notification arrives.
	 *
	 * argument notification string - The identifier of the noitication.
	 * argument payload mixed - The payload of the notification.
	 */
	socketNotificationReceived: function(notification, payload) {
		switch(notification) {
			case "MMM-CasperValidator-THEIR_NODE_STATUS":
				this.sendNodeStatus(notification, payload);
				break;
			case "MMM-CasperValidator-OUR_NODE_STATUS":
				this.sendNodeStatus(notification, payload);
				break;
			case "MMM-CasperValidator-REWARDS":
				this.sendRewards(notification, payload.validatorAddress);
				break;
			case "MMM-CasperValidator-GET_AUCTION_INFO":
				this.sendStakedInfo(payload);
				break;
		}
	},

	sendStakedInfo: async function(payload) {
		let auctionInfo = await this.requestAuctionInfo(payload);
		let bidData = auctionInfo.auction_state.bids.filter((obj) => obj.public_key == payload.validatorAddress)[0];
		let selfStakedAmount = this.convertToCSPR(bidData.bid.staked_amount);
		let delegatorStakedAmount = bidData.bid.delegators.map(a => this.convertToCSPR(a.staked_amount)).reduce((a, b) => a + b, 0);

		this.sendSocketNotification("MMM-CasperValidator-STAKED_INFO", {
			selfStaked: selfStakedAmount,
			totalStaked: selfStakedAmount + delegatorStakedAmount,
			active: !bidData.bid.inactive
		});
	},

	convertToCSPR: function(motes) {
		return parseInt(motes) / 1e9;
	},

	requestAuctionInfo: function(payload) {
		return axios.post(payload.nodeUrl, {
			id: "0",
			jsonrpc: "2.0",
			method: "state_get_auction_info"
		})
		.then(res => res.data.result)
		.catch(error => console.log(error));
	},

	sendNodeStatus: async function(notification, payload) {
		let nodeStatus = await this.getCasperRPC(payload.nodeUrl);
		this.sendSocketNotification(notification, nodeStatus);
	},

	sendRewards: function(notification, validatorAddress) {
		var self = this;

		axios.get(`https://event-store-api-clarity-mainnet.make.services/validators/${validatorAddress}/rewards?with_amounts_in_currency_id=1&page=1&limit=4&order_direction=DESC`)
		.then(res => self.sendSocketNotification(notification, res.data) )
		.catch(error => console.log(error));
	},

	getCasperRPC: function(url) {
		var self = this;

		return axios.post(url, {
			id: "0",
			jsonrpc: "2.0",
			method: "info_get_status"
		})
		.then(res => self.parseRPCData(res.data))
		.catch(error => { return { era_id: 0, height: 0, next_upgrade: null } });
	},

	parseRPCData: function(data) {
		return {
			era_id: data.result.last_added_block_info.era_id,
			height: data.result.last_added_block_info.height,
			next_upgrade: data.result.next_upgrade
		}
	},
});
