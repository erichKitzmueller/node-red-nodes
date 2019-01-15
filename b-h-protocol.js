module.exports = function(RED) {
    function BavariaHessiaNode(config) {
        RED.nodes.createNode(this,config);
        var node = this;
        
        var checksum = function(buf, len) {
            var c = 0;
            for (var i=0; i<len; i++) {
                c = c ^ buf[i];
            }
            return c;
        };
        
        // format number as 2-digit hex
        var toHex2 = function(n) {
             return ('0'+n.toString(16).toUpperCase()).slice(-2);
        };
        
        // format number as 3-digit decimal with leading zeroes
        var toDec3 = function(n) {
             return ('00'+n.toString()).slice(-3);
        };
        
        // the Bavaria-Hessia-protocol has this exponential format for the measured values: ±MMMM±EE with an implicit decimal point in the mantissa after the first digit
        // for example, PI => '+3142+00'
        var fmtFloat = function(n) {
             var mant_exp = parseFloat(n.toPrecision(4)).toExponential().split('e');
             var mant = mant_exp[0];
             var exp = mant_exp[1];
             
             if (mant.charAt(0)!='-') mant = '+'+mant;
             if (mant.length==2) mant+='.0';
             
             if (mant.charAt(2)!='.') {
                 node.error('fmtFloat: decimal point not found where expected: '+mant);
                 return;
             }
             mant = (mant.substring(0,2)+mant.substring(3)+'0000').substring(0,5);
             if (exp.charAt(0) != '+' && exp.charAt(0) != '-') {
                 node.error('fmtFloat: exponent sign not found as expected');
                 return;
             }
             
             if (exp.length==2) {
                 exp=exp.charAt(0)+'0'+exp.charAt(1);
             }
             
             if (exp.length>3) {
                 if (exp.charAt(0)=='-') {  // underflow, replace value with a special notion of 0
                   return exp.charAt(0)+'0000-99'; 
                 }
                 node.error('fmtFloat: value too large');
                 return;
             }
             
             return mant+exp;
        };
        
        node.on('input', function(msg) {
            var incoming = !(typeof(msg.payload) == 'object' && typeof(msg.payload.telegramtype) == 'string');
            
            if (incoming) {
                // parse incoming b-h-telegram, must be string or Buffer
                var buf;
                if (typeof(msg.payload) == 'string') {
                    buf = new Buffer(msg.payload, 'ascii');  // Developed and test on nodejs version 4.6.2, which doesn't support the newer "Buffer.from(msg.payload, 'ascii')" function
                }
                else if (typeof(msg.payload) == 'object') {
                    buf = msg.payload;
                }
                else {
                    node.error('invalid payload type');
                    return;
                }
                
                if (buf.length<4 || buf[0] != 2 || buf[buf.length-3] != 3) {
                    node.error('payload does not contain STX and ETX where expected');
                    return;
                }
                var hexAsciiValue = function(n) {
                  return (n<58)?n-48:n-55;
                };
                
                var cs = hexAsciiValue(buf[buf.length-2])*16 + hexAsciiValue(buf[buf.length-1]);
                
                if (cs != checksum(buf, buf.length-2)) {
                    node.error('invalid checksum, got '+toHex2(cs)+' but expected '+toHex2(checksum(buf, buf.length-2)));
                    return;
                }
                
                var telegram = buf.toString('ascii',1,buf.length-3);
                
                var bhdata = {
                     telegramtype: telegram.substring(0,2)
                };
                
                switch(bhdata.telegramtype) {
                     case 'DA': 
                         if (telegram.length != 2 && telegram.length != 5) {
                             node.error('invalid DA telegram length');
                             return;
                         }
                       
                         if (telegram.length==5) {
                             bhdata.component = parseInt(telegram.substring(2));
                         }
                         break;
                     case 'ST':
                         if (telegram.length < 6) {
                             node.error('invalid ST telegram length');
                             return;
                         }
                       
                         bhdata.component = parseInt(telegram.substring(2,5));
                         bhdata.command = telegram.substring(5);
                         break;
                     case 'MD':  
                         var n = parseInt(telegram.substring(2,4));
                         if (telegram.length != 5+30*n) {
                             node.error('invalid MD telegram length, expected '+(7+30*n)+' but got '+telegram.length+ ' (excluding STX,ETX,CC)');
                             return;
                         }
                         bhdata.components = [];
                         for(var i=0; i<n; i++) {
                            var part = telegram.substring(5+i*30, 35+i*30);
                            bhdata.components.push({
                                component: parseInt(part.substring(0,3)),
                                value: parseFloat(part.substring(4,6)+'.'+part.substring(6,9)+'e'+part.substring(9,12)),
                                opsts: parseInt(part.substring(13,15), 16),
                                errsts:parseInt(part.substring(16,18), 16),
                                serial: parseInt(part.substring(19,22))
                            });
                         }
                         break;
                }
                
                msg.payload = bhdata;
                
            }
            else {
                // create b-h-telegram based on the object given in payload
              
                bhdata = msg.payload;
                if (typeof(bhdata) != 'object' || bhdata.telegramtype != 'DA' && bhdata.telegramtype != 'MD' && bhdata.telegramtype != 'ST') {
                     node.error('invalid telegram type');
                     return;
                }
                
                var telegram = '\2'+bhdata.telegramtype;
                
                switch(bhdata.telegramtype) {
                    case 'DA':
                        if (typeof(bhdata.component) == 'number') {
                            telegram += toDec3(bhdata.component);
                        }
                        break;
                    case 'ST':
                        telegram += toDec3(bhdata.component);
                        telegram += bhdata.command;
                        break;
                    case 'MD':
                        telegram += ('0'+bhdata.components.length).slice(-2)+' ';
                        for (var i=0; i<bhdata.components.length; i++) {
                            var c = bhdata.components[i];
                            telegram += toDec3(c.component||0)+' ';
                            telegram += fmtFloat(c.value||0.0)+' ';
                            telegram += toHex2(c.opsts||0)+' ';
                            telegram += toHex2(c.errsts||0)+' ';
                            telegram += toDec3(c.serial||0)+' ';
                            telegram += '000000 ';  // left free in the protocol specification
                        }
                        break;
                }
                
                telegram += '\3';
                var buf = new Buffer(telegram, 'ascii');
                telegram += toHex2(checksum(buf, buf.length));
                msg.payload = telegram;                
            }
            node.send(msg);
        });
    }
    RED.nodes.registerType('b-h-protocol',BavariaHessiaNode);
}
