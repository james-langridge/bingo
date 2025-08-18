import { useState } from "react";
import { ChevronDown, ChevronUp, Smartphone, Monitor } from "lucide-react";

export function InstallInstructions() {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<
    "ios" | "android" | "desktop"
  >("ios");

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex justify-between items-center text-left"
      >
        <h2 className="text-2xl font-semibold">Install App</h2>
        {isOpen ? (
          <ChevronUp className="h-5 w-5 text-gray-500" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-500" />
        )}
      </button>

      {isOpen && (
        <div className="mt-4 space-y-4">
          <p className="text-gray-600">
            Install Bingo as an app on your device for quick access and offline
            play.
          </p>

          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedPlatform("ios")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                selectedPlatform === "ios"
                  ? "border-blue-500 bg-blue-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <Smartphone className="h-4 w-4" />
              iOS (iPhone/iPad)
            </button>
            <button
              onClick={() => setSelectedPlatform("android")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                selectedPlatform === "android"
                  ? "border-green-500 bg-green-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <Smartphone className="h-4 w-4" />
              Android
            </button>
            <button
              onClick={() => setSelectedPlatform("desktop")}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                selectedPlatform === "desktop"
                  ? "border-purple-500 bg-purple-50"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <Monitor className="h-4 w-4" />
              Desktop
            </button>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            {selectedPlatform === "ios" && (
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">iOS Safari</h3>
                <ol className="space-y-2 text-sm">
                  <li className="flex items-start">
                    <span className="font-semibold mr-2 text-blue-500">1.</span>
                    <span>
                      Open this website in Safari (not Chrome or other browsers)
                    </span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2 text-blue-500">2.</span>
                    <span>
                      Tap the Share button (square with arrow pointing up) at
                      the bottom of the screen
                    </span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2 text-blue-500">3.</span>
                    <span>Scroll down and tap "Add to Home Screen"</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2 text-blue-500">4.</span>
                    <span>Name the app "Bingo" and tap "Add"</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2 text-blue-500">5.</span>
                    <span>The app will appear on your home screen!</span>
                  </li>
                </ol>
                <p className="text-xs text-gray-500 mt-3">
                  Note: This only works in Safari. Chrome and other browsers on
                  iOS don't support this feature.
                </p>
              </div>
            )}

            {selectedPlatform === "android" && (
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">Android Chrome</h3>
                <ol className="space-y-2 text-sm">
                  <li className="flex items-start">
                    <span className="font-semibold mr-2 text-green-500">
                      1.
                    </span>
                    <span>Open this website in Chrome</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2 text-green-500">
                      2.
                    </span>
                    <span>Tap the three dots menu in the top right corner</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2 text-green-500">
                      3.
                    </span>
                    <span>Tap "Install app" or "Add to Home screen"</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2 text-green-500">
                      4.
                    </span>
                    <span>Confirm by tapping "Install"</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2 text-green-500">
                      5.
                    </span>
                    <span>
                      The app will be added to your home screen and app drawer!
                    </span>
                  </li>
                </ol>

                <h3 className="font-semibold text-lg mt-4">Samsung Internet</h3>
                <ol className="space-y-2 text-sm">
                  <li className="flex items-start">
                    <span className="font-semibold mr-2 text-green-500">
                      1.
                    </span>
                    <span>Tap the menu button (three lines) at the bottom</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2 text-green-500">
                      2.
                    </span>
                    <span>Tap "Add page to" → "Home screen"</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2 text-green-500">
                      3.
                    </span>
                    <span>Confirm the name and tap "Add"</span>
                  </li>
                </ol>

                <h3 className="font-semibold text-lg mt-4">Firefox</h3>
                <ol className="space-y-2 text-sm">
                  <li className="flex items-start">
                    <span className="font-semibold mr-2 text-green-500">
                      1.
                    </span>
                    <span>Tap the three dots menu</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2 text-green-500">
                      2.
                    </span>
                    <span>Tap "Install"</span>
                  </li>
                </ol>
              </div>
            )}

            {selectedPlatform === "desktop" && (
              <div className="space-y-3">
                <h3 className="font-semibold text-lg">Chrome / Edge / Brave</h3>
                <ol className="space-y-2 text-sm">
                  <li className="flex items-start">
                    <span className="font-semibold mr-2 text-purple-500">
                      1.
                    </span>
                    <span>
                      Look for the install icon in the address bar (usually on
                      the right side)
                    </span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2 text-purple-500">
                      2.
                    </span>
                    <span>
                      Click the install button or go to the three dots menu →
                      "Install Bingo..."
                    </span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2 text-purple-500">
                      3.
                    </span>
                    <span>Click "Install" in the dialog that appears</span>
                  </li>
                  <li className="flex items-start">
                    <span className="font-semibold mr-2 text-purple-500">
                      4.
                    </span>
                    <span>
                      The app will open in its own window and be added to your
                      applications!
                    </span>
                  </li>
                </ol>

                <h3 className="font-semibold text-lg mt-4">Firefox</h3>
                <p className="text-sm text-gray-600">
                  Firefox on desktop doesn't currently support PWA installation.
                  Use Chrome, Edge, or Brave for the best app experience.
                </p>

                <h3 className="font-semibold text-lg mt-4">Safari (macOS)</h3>
                <p className="text-sm text-gray-600">
                  Safari on macOS doesn't currently support PWA installation.
                  Use Chrome, Edge, or Brave for the best app experience.
                </p>
              </div>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>Why install?</strong> Installing Bingo as an app gives you
              quick access from your home screen, works offline, and provides a
              full-screen experience without browser toolbars.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
