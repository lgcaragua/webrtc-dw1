/// <reference path="../../../typings/angularjs/angular.d.ts"/>
var app = angular.module('webrtc', ['luegg.directives','ui.router', 'ngAnimate']);

app.config(['$stateProvider', '$urlRouterProvider', function($stateProvider, $urlRouterProvider) {
	$stateProvider
	.state('home', {
		url: '/',
		templateUrl: 'views/home.html'
	})
	.state('chat', {
		url: '/chat/',
		templateUrl: 'views/chat.html',
		controller: 'chatCtrl',
		templateUrl: 'views/chat.html'
	})
	.state('tecnologia', {
		url: '/tecnologia/',
		templateUrl: 'views/tecnologia.html'
	})
	.state('quemsomos', {
		url: '/quemsomos/',
		templateUrl: 'views/quemsomos.html'
	});
}]);

app.controller('mainCtrl', ['$scope', '$state', function($scope, $state) {
	$state.go('tecnologia');
}]);

app.controller('chatCtrl', ['$scope','$state', function($scope, $state) {
	var socket = io();
	var msgAudio = new Audio('audio/msg.mp3');
	//$scope.list = ['Rogério', 'Gustavo', 'Noboru San', 'Adalberto', 'Kellen'];
	$scope.list = []
	$scope.conversas = {};	
	
	$scope.selContato = function(contato) {
		$scope.contatoAtivo = contato;
		$scope.chatMsg = "";
		if ($scope.conversas[$scope.contatoAtivo]) $scope.conversas[$scope.contatoAtivo].unread = 0;
	};
	
	$scope.enviaMsg = function() {				
		$scope.addMsg($scope.contatoAtivo, {text:$scope.chatMsg, quem:'self'});
		socket.emit('chat', JSON.stringify({
			de:$scope.userLogin,
			para:$scope.contatoAtivo,
			text:$scope.chatMsg
		}));
		$scope.chatMsg = "";				
	};			
	//$scope.usuario = {};	
	$scope.peer = null;		
	var viewPath = 'views/';
	$scope.route =  viewPath+'login.html';
	$scope.audio = new Audio();		
	
	$scope.go = function(partial) {
		$scope.route = viewPath+partial;		
	};
	$scope.setError = function(msg) {
		$scope.error = msg;
	};
		
	$scope.addMsg = function(contato, msg) {
		if (!$scope.conversas[contato]) 
			$scope.conversas[contato] = {msgs:[]};		
		$scope.conversas[contato].msgs.push(msg);		
	};		
	
	
	socket.on('chat', function(data) {
		var msg = JSON.parse(data);
		$scope.addMsg(msg.de, {text:msg.text, quem:'remote'});
		if ($scope.contatoAtivo !== msg.de)
			$scope.conversas[msg.de].unread ? $scope.conversas[msg.de].unread++ : $scope.conversas[msg.de].unread = 1;
		msgAudio.play();
		$scope.$apply();
	});
	
	socket.on('entrar', function(data) {
		var msg = JSON.parse(data);	
		if (msg.error) {
			$scope.loginError = msg.error;			
		} else {					
			$scope.loginError = "";
			$scope.usuario = {nome:msg.nomeLogado};			
		}
	});		
	
	socket.on('disconnect', function() {
		$scope.go('login.html');
		$scope.usuario = {};		
	});
	
	socket.on('lista', function(data) {
		var lista = JSON.parse(data);
		var i = lista.indexOf($scope.userLogin);
		lista.splice(i,i+1);
		$scope.list = lista;
		$scope.$apply();

	});
	
	
	$scope.login = function() {		
		socket.emit('entrar', $scope.userLogin);		
	};
	
	$scope.logout = function() {		
		socket.emit('sair', $scope.usuario.nome);	
		$scope.go('login.html');
		$scope.usuario = {};	
	};
	
	
	$scope.recebendo = false;	
	$scope.btnAtender = false;
	
	$scope.atender = function() {
		iniciaConversa();	
		$scope.callMsg = "Conectando...";			
	};
	
	$scope.desligar = function() {
		if (pc.iceConnectionState !== 'closed')		
			pc.close();
			socket.emit('chamada', JSON.stringify({para: $scope.peer, bye:true, dados: {de:$scope.usuario.nome}}));	
			$scope.isInCall = false;
			$scope.isCaller = false;														
	};
	
	$scope.msgOnKey = function(event) {
		if (event.keyCode === 13 && !event.shiftKey) {
			event.preventDefault();
			if ($scope.chatMsg) $scope.enviaMsg();			
		}
	};
	
	function setAudio(audio) {
				
		$scope.audio.src = audio;
		$scope.audio.play();
	}
	
	function setCallMsg(msg) {
		$scope.callMsg = msg;
		$scope.$apply();
	}
	
	socket.on('chamada', function (json) {
		var chamada = JSON.parse(json);
		if (chamada.error) {
			alert("Não foi possivel realizar a operação. Erro: " + chamada.error);
			return;
		}
		if (chamada.bye) {
			console.log("Chamada desligada pelo peer remoto");
			pc.close();	
			$scope.isInCall = false;
			$scope.isCaller = false;				
			$scope.go('list.html');	
			$scope.$apply();
		}
		//			if ($scope.$scope.isInCall && !$scope.isCaller) {
		//				socket.emit("chamada",
		//				JSON.stringify({
		//						para:chamada.dados.de, 
		//						error: "Usuário já está em uma chamada!", 
		//						dados: {de:$scope.usuario.nome}
		//					})
		//				);
		//				return;
		//			}
		if (chamada.dados.oferta) {
			if (!$scope.isInCall) {
				ofertaRecebida = chamada.dados.oferta;
				$scope.peer = chamada.dados.de;
				$scope.recebendo = true;
				setCallMsg("Recebendo chamada de " + $scope.peer);				
				setAudio("audio/ring.mp3");
				$scope.isInCall = true;
				$scope.btnAtender = true;
				$scope.$apply();
			}
		} else if (chamada.dados.resposta) {
			pc.setRemoteDescription(
				new window.RTCSessionDescription(chamada.dados.resposta),
				function () {
					setCallMsg("Em chamada com " + $scope.peer);
					$scope.isInCall = true;

				},
				function (error) {
					console.log("Falha na conexão: " + error);
					if (pc.iceConnectionState !== 'connected') {
						$scope.peer = null;
						$scope.isInCall = false;
						$scope.recebendod = false;
						$scope.isCaller = false;
						$scope.go('list.html');
					}
				}
				);
		}
	});
	//Transforma binário em URL
	window.URL = window.URL || window.webkitURL;
	//getUserMedia => request dos recursos de audio/video do usuário
	navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
	// Cria a conexão WebRTC com outro $scope.peer
	window.RTCPeerConnection = window.RTCPeerConnection || window.mozRTCPeerConnection || window.webkitRTCPeerConnection;
	//Manipula os SDP local e remoto
    window.RTCSessionDescription = window.RTCSessionDescription || window.mozRTCSessionDescription || window.webkitRTCSessionDescription;
	//controlador do ICE Agente, que envia nossos candidatos para o peer
    window.RTCIceCandidate = window.RTCIceCandidate || window.mozRTCIceCandidate || window.webkitRTCIceCandidate;
	//Configurações do getuserMedia
	var constraints = {audio:true, video:false};
	var ice = {"iceServers": [
		{"url": "stun:stun.l.google.com:19302"}
	]};
	var pc = null;
	
	$scope.isCaller = false;
	$scope.isInCall = false;
	var ofertaRecebida = null;
	var mediaStream = null;
	
	
	// navigator.getUserMedia(constraints, 
	// 	function(stream) {
	// 		mediaStream = stream;
	// 	}, getMediaError);
	
	//var pc = null;
	
	$scope.audioSrc = null;
	

	
	function getMediaSuccess(stream) {
		//Cria o RTCPeerConnection
		pc = new window.RTCPeerConnection(ice);
		
		pc.onaddstream = onStreamAdded;
		//Adiciona o mediaStream local ao RTCPeerCon
		pc.addStream(stream);
		
		
		//Callbacks do RTCPC

		pc.onicecandidate = onIceCandidate;
		
		pc.oniceconnectionstatechange = onConnectionChange;
		
		var offerConstraints = {
			mandatory: {
				OfferToReceiveAudio: true
			}
		};
		
		if ($scope.isCaller) {
			//Chamar createOffer() irá executar o processo ICE			
			pc.createOffer(function (offerSDP) {
	   			pc.setLocalDescription(new window.RTCSessionDescription(offerSDP),
					//Sucesso ao setar localDescription - pode enviar a oferta(trickle ICE)
					function() {
//						var oferta = { "de": $scope.usuario.nome ,"oferta": pc.localDescription};
//						socket.emit("chamada", JSON.stringify( {"para": $scope.peer, "dados":oferta} ));
						console.log("SDP Local configurado");
					},
					//Falha ao setar localDescription
					function() {
						console.log("Falha ao configurar SDP local");
								});
						},
			function(err) {
				console.log("Não foi possivel construir oferta: "+err);
			}, offerConstraints);
		} else {
			pc.setRemoteDescription(new window.RTCSessionDescription(ofertaRecebida),
				//Sucesso ao setar SDP pra resposta
				function() {
					console.log(ofertaRecebida);
					pc.createAnswer(
						//Resposta criada com sucesso
						function (respostaSDP) {
						pc.setLocalDescription(
							new window.RTCSessionDescription(respostaSDP),
	   						//Sucesso ao setar localDescription - pode enviar a resposta(trickle ICE)
							function() {
								// var resposta = {"de": $scope.usuario.nome , "resposta":pc.localDescription };
								// socket.emit("chamada", JSON.stringify({ "para": $scope.peer, "dados":resposta}));
								console.log("SDP Local configurado");
							},
							//Falha ao setar localDescription
							function() {
								console.log("Falha ao configurar SDP local");
							});
					//Falha ao construir a resposta		
					}, function(err) {
						console.log("Não foi possivel construir resposta: "+err);
					});
			//Falha ao setRemoteDescription
			}, function() {
				console.log("Falha ao construir SDP remoto");
			});
		}
	};
	
	function onConnectionChange(evt) {
		console.log(evt);
		var connState = evt.target.iceConnectionState;
		if (connState == 'closed') {
			$scope.isInCall = false;
			$scope.isCaller = false;				
		}
	}
		
		function onIceCandidate(evt) {
			//Espera por todos os candidates serem encontrados e envia para nosso peer
			console.log("onIceCandidate: "+evt.target.iceGatheringState);
			if (evt.target.iceGatheringState === "complete") {
				console.log("Busca ICE completa, enviando SDP para peer remoto:");
				console.log(evt.target);
				
				if ($scope.isCaller) {
					var oferta = { "de": $scope.usuario.nome, "oferta": pc.localDescription };
					socket.emit("chamada", JSON.stringify({ "para": $scope.peer, "dados": oferta }));
				} else {
					var resposta = { "de": $scope.usuario.nome, "resposta": pc.localDescription };
					socket.emit("chamada", JSON.stringify({ "para": $scope.peer, "dados": resposta }));
				}
			}
		}
		
		function onStreamAdded(evt) {
			var url = URL.createObjectURL(evt.stream);			
			setAudio(url);
			console.log("stream added!");
			setCallMsg("Em chamada com "+$scope.peer);
		}
		
	//Falha
	function getMediaError(err) {
		console.log('Falha ao capturar audio!');
		console.log(err);
		$scope.isCaller = false;
		$scope.isInCall = false;
		$scope.peer = null;
		alert("Falha ao obter acesso ao microfone!");		
		return;
	}		
		
	$scope.call = function(quem) {
		$scope.peer = quem;
		$scope.isCaller = true;		
		$scope.callMsg = "Ligando para "+$scope.peer;				
		$scope.go('call.html');
		setAudio("audio/call.mp3");		
				
		iniciaConversa();
	};
	
	function iniciaConversa() {
		navigator.getUserMedia(constraints, getMediaSuccess, getMediaError);		
		//navigator.getUserMedia(constraints, getMediaSuccess, getMediaError);		
	}
	
	
	
//	SignalingService.setSocket(io());
//	$scope.login = SignalingService.entrar($scope.usuario.nome, console.log, $scope.setError);
//	SignalingService.onEntrar(function() {
//			$scope.go('list.html');
//		});
//		
//	SignalingService.onDisconnect(function() {
//			$scope.go('login.html');
//		});
//	
//		var sig = new SignalingService(io());
		
//		$scope.login = function() {			
//		SignalingService.entrar($scope.usuario.nome)
//		.then(console.log, $scope.setError);
//		};
//		
//		SignalingService.onEntrar()
//		.then(function() {
//				$scope.go('list.html');
//			}
//		)
//		.catch($scope.setError);
//		
//		SignalingService.onDisconnect()
//		.then( function() {
//			$scope.go('login.html');
//		});
//		
//		$scope.hoverUser = function(user) {
//			$scope.hoveredUser = user;
//		};
}]);