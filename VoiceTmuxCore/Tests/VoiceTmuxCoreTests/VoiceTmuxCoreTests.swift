import XCTest
@preconcurrency @testable import VoiceTmuxCore

final class VoiceTmuxCoreTests: XCTestCase {
    func testPaneRouteExtractsSessionNameAndPaneId() {
        let route = PaneDetailRoute.terminal(sessionName: "main", paneId: "%1")
        XCTAssertEqual(route.sessionName, "main")
        XCTAssertEqual(route.paneId, "%1")
    }

    func testStopRecordingSendsEndFrameAndClosesWebSocket() {
        let delegate = DummyDelegate()
        let scheduler = TestScheduler()
        let webSocket = FakeWebSocketTask()
        let service = XunfeiSpeechService(delegate: delegate, scheduler: scheduler, webSocketTask: webSocket, audioEngine: nil)
        service.setRecordingStateForTesting(true)

        service.stopRecording()

        guard case .string(let payload)? = webSocket.lastSentMessage else {
            XCTFail("Expected end frame payload")
            return
        }

        let data = Data(payload.utf8)
        let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
        let header = json?["header"] as? [String: Any]
        let payloadDict = json?["payload"] as? [String: Any]
        let audio = payloadDict?["audio"] as? [String: Any]

        XCTAssertEqual(header?["status"] as? Int, 2)
        XCTAssertEqual(audio?["audio"] as? String, "")
        XCTAssertEqual(audio?["status"] as? Int, 2)
        XCTAssertEqual(scheduler.delaySeconds, 1)

        scheduler.runScheduled()
        XCTAssertEqual(webSocket.cancelCode, .goingAway)
    }

    func testStopRecordingSchedulesCancelAfterSendCompletion() {
        let delegate = DummyDelegate()
        let scheduler = TestScheduler()
        let webSocket = FakeWebSocketTask(autoCompleteSend: false)
        let service = XunfeiSpeechService(delegate: delegate, scheduler: scheduler, webSocketTask: webSocket, audioEngine: nil)
        service.setRecordingStateForTesting(true)

        service.stopRecording()

        XCTAssertNil(scheduler.delaySeconds)

        webSocket.completeSend()

        XCTAssertEqual(scheduler.delaySeconds, 1)
    }
}

private final class DummyDelegate: STTDelegate {
    func onPartialResult(text: String) {}
    func onFinalResult(text: String) {}
    func onError(_ error: Error) {}
}

private final class FakeWebSocketTask: WebSocketTasking {
    var lastSentMessage: URLSessionWebSocketTask.Message?
    var cancelCode: URLSessionWebSocketTask.CloseCode?
    private let autoCompleteSend: Bool
    private var pendingSendCompletion: ((Error?) -> Void)?

    init(autoCompleteSend: Bool = true) {
        self.autoCompleteSend = autoCompleteSend
    }

    func resume() {}

    func send(_ message: URLSessionWebSocketTask.Message, completionHandler: @escaping @Sendable (Error?) -> Void) {
        lastSentMessage = message
        if autoCompleteSend {
            completionHandler(nil)
        } else {
            pendingSendCompletion = completionHandler
        }
    }

    func completeSend() {
        pendingSendCompletion?(nil)
        pendingSendCompletion = nil
    }

    func receive(completionHandler: @escaping @Sendable (Result<URLSessionWebSocketTask.Message, Error>) -> Void) {}

    func cancel(with closeCode: URLSessionWebSocketTask.CloseCode, reason: Data?) {
        cancelCode = closeCode
    }
}


private final class TestScheduler: Scheduler {
    private(set) var delaySeconds: TimeInterval?
    private var action: (() -> Void)?

    func schedule(after seconds: TimeInterval, _ action: @escaping () -> Void) {
        delaySeconds = seconds
        self.action = action
    }

    func runScheduled() {
        action?()
    }
}
