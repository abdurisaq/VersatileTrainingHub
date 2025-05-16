import Link from "next/link";

export default function HubGuidePage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-3xl md:text-4xl font-bold mb-8 text-center">
        Welcome to the Versatile Training Hub!
      </h1>

      <section className="mb-8 p-6 bg-white rounded-lg shadow">
        <p className="text-lg text-gray-700 mb-4">
          Share your custom training packs and discover new ones created by the community through the Versatile Training Hub!
        </p>
        <hr className="my-4" />
        <p className="text-gray-700">
          The Hub is a community platform for sharing and discovering training packs. It allows users to upload their pack data, which are then made available for others to download and play directly in-game via the VersatileTraining plugin. This facilitates a central place for the community to exchange diverse training scenarios, enhancing the utility of the plugin.
        </p>
      </section>

      <section className="mb-8 p-6 bg-white rounded-lg shadow">
        <h2 className="text-2xl font-semibold mb-4 text-purple-700">Downloading the VersatileTraining Plugin</h2>
        <p className="text-gray-700 mb-3">
          To get started with uploading your own packs or loading packs from the Hub directly into your game, you&apos;ll need the VersatileTraining BakkesMod plugin.
        </p>
        <p className="text-gray-700 mb-4">
          You can download the latest version of the plugin here:
        </p>
        <div className="text-center">
          <Link
            href="/plugin-download-placeholder" // Replace with actual link when available
            className="inline-block bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-md text-lg transition-colors"
            target="_blank" 
            rel="noopener noreferrer"
          >
            Download Plugin (Link Coming Soon)
          </Link>
        </div>
        <p className="text-sm text-gray-500 mt-3 text-center">
          (Installation instructions will be provided with the download.)
        </p>
      </section>

      <section className="mb-8 p-6 bg-white rounded-lg shadow">
        <h2 className="text-2xl font-semibold mb-4 text-orange-600">Uploading Your Packs</h2>
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>Make sure Rocket League is running with the VersatileTraining plugin active; the website will connect to it for uploading.</li>
          <li>On this Hub website, <Link href="/api/auth/signin" className="text-blue-600 hover:underline">create an account or log in</Link>.</li>
          <li>Navigate to the <Link href="/training-packs/upload" className="text-blue-600 hover:underline">Upload Pack</Link> page.</li>
          <li>Select the training pack you wish to upload from the list (populated from your game).
            <ul className="list-disc list-inside ml-6 text-sm text-gray-600">
                <li>If you don&apos;t see your pack, ensure it has been published in-game (it usually needs a code assigned by Rocket League).</li>
            </ul>
          </li>
          <li>Fill in the pack name (if not auto-filled), description, difficulty, and any relevant tags.</li>
          <li>Choose the visibility for your pack and click &quot;Upload Training Pack&quot;.</li>
        </ul>
      </section>

      <section className="mb-8 p-6 bg-white rounded-lg shadow">
        <h2 className="text-2xl font-semibold mb-4 text-yellow-600">Updating Your Packs</h2>
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>To update your training pack, first make any desired modifications and save them within Rocket League using the VersatileTraining plugin.</li>
          <li>Ensure Rocket League is running with the plugin active.</li>
          <li>Go to your <Link href="/profile" className="text-blue-600 hover:underline">Profile</Link> on the Hub.</li>
          <li>Under the &quot;Your Training Packs&quot; section, find the pack you want to update.</li>
          <li>Click the &quot;Update from Plugin&quot; button next to the pack. This will fetch the latest data from your game and update it on the Hub.</li>
        </ul>
      </section>

      <section className="mb-8 p-6 bg-white rounded-lg shadow">
        <h2 className="text-2xl font-semibold mb-4 text-green-600">Downloading & Playing Packs</h2>
        <ul className="list-disc list-inside space-y-2 text-gray-700">
          <li>Make sure Rocket League is running with the VersatileTraining plugin active.</li>
          <li>Browse or search for packs on the <Link href="/training-packs" className="text-blue-600 hover:underline">Training Packs</Link> page.</li>
          <li>Once you find a pack you like, open its page and click the &quot;Load in Game&quot; button.</li>
          <li>The plugin will download and install the pack, and it should load automatically in Rocket League.</li>
          <li>You can also download the pack data as a <code className="text-sm bg-gray-200 px-1 rounded">.json</code> file if you prefer to manage it manually.</li>
        </ul>
      </section>
      
      <div className="text-center mt-10">
        <Link href="/training-packs" className="text-blue-600 hover:underline font-medium">
          ← Back to Browse Training Packs
        </Link>
      </div>
    </div>
  );
}