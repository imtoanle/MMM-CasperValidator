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
		if (notification === "MMM-CasperValidator-OFFICIAL_RPC") {
			this.getCasperRPC(notification, 'https://node-clarity-mainnet.make.services/rpc');
		} else if (notification === "MMM-CasperValidator-COMPARE_NODES") {
			// this.getCasperRPC(notification, payload.ourNode);
			this.compareBothNodes(payload);
		}
	},

	compareBothNodes: async function(payload) {
		let theirNode = await this.getCasperRPC(payload.theirNode);
		let ourNode = await this.getCasperRPC(payload.ourNode);

		this.sendSocketNotification("MMM-CasperValidator-COMPARE_NODES", {
			theirNode: theirNode,
			ourNode: ourNode
		});
	},
	getCasperRPC: function(url) {
		var self = this;

		return axios.post(url, {
			id: "0",
			jsonrpc: "2.0",
			method: "info_get_status"
		})
		.then( res => self.parseRPCData(res.data) )
		.catch( error => console.log(error) );
	},

	parseRPCData: function(data) {
		return {
			era_id: data.result.last_added_block_info.era_id,
			height: data.result.last_added_block_info.height,
			next_upgrade: data.result.next_upgrade
		}
	}
});
