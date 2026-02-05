import SwiftUI

struct VoiceControlView: View {
    @StateObject var viewModel = VoiceViewModel()
    var onCommit: (String) -> Void
    
    var body: some View {
        HStack {
            if !viewModel.partialText.isEmpty {
                Text(viewModel.partialText)
                    .lineLimit(1)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            
            if let error = viewModel.error {
                 Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
            }
            
            Spacer()
            
            Button {
                viewModel.toggleRecording()
            } label: {
                Image(systemName: viewModel.isRecording ? "mic.fill" : "mic.slash.fill")
                    .font(.title2)
                    .padding(8)
                    .background(viewModel.isRecording ? Color.red : Color.gray.opacity(0.2))
                    .foregroundStyle(viewModel.isRecording ? .white : .primary)
                    .clipShape(Circle())
            }
        }
        .padding(8)
        .background(.ultraThinMaterial)
        .cornerRadius(12)
        .onAppear {
            viewModel.onTextRecognized = { text in
                onCommit(text)
            }
        }
    }
}
