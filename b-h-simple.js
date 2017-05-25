module.exports = function(RED) {
    function BavariaHessiaSimpleNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;
        node.on('input', function(msg) {
            if (typeof(msg.payload)=='number') {
                msg.payload = {
                     telegramtype: 'MD',
                     components: [
                         {
                             component: config.component,
                             value: msg.payload,
                             opsts: 0,
                             errsts: 0,
                             serial: config.serial
                         }
                         
                     ]
                };
            }
            else if (typeof(msg.payload)=='object' && msg.payload.telegramtype=='MD') {
                msg.payload = msg.payload.components[0].value;
            }
            else {
                node.error('Received an invalid payload');
                return;
            }
           
            node.send(msg);
        });
    }
    RED.nodes.registerType('b-h-simple',BavariaHessiaSimpleNode);
}